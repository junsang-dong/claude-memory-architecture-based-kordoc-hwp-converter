import Busboy from "busboy";
import { Readable } from "node:stream";
import { parse } from "kordoc";
import Anthropic from "@anthropic-ai/sdk";

const MAX_BYTES = 10 * 1024 * 1024;
/** Claude 입력 상한(대략 토큰·지연 방지). kordoc 전체 텍스트는 여전히 클라이언트 응답용으로 사용 가능 */
const MAX_CLAUDE_INPUT_CHARS = 140_000;
const ALLOWED_EXT = new Set([".hwp", ".hwpx", ".pdf"]);

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const FALLBACK_MODEL = "claude-3-5-sonnet-20241022";

const CONVERT_PROMPT = `당신은 한국어 문서 전문가입니다.
아래 텍스트는 한글(HWP) 문서에서 추출한 원문입니다.
이 텍스트를 구조적인 마크다운 문서로 변환해주세요.

규칙:
- 제목/소제목은 #, ##, ### 헤더로 표현
- 표는 마크다운 테이블로 변환
- 목록은 - 또는 1. 형식 사용
- 원본 내용을 수정하지 말 것
- 불필요한 공백/개행 정리

[원문 텍스트]`;

const ANALYSIS_PROMPT = `아래 한국어 문서를 분석하고 결과를 반드시 JSON 형식으로만 반환하세요.

반환 형식:
{
  "summary": "3문장 이내 요약",
  "keywords": ["핵심키워드 최대 7개"],
  "structure": "문서 유형 (보고서/계획서/계약서/기타)",
  "tone": "문서 톤 (공식적/비공식적/기술적)",
  "key_sections": ["주요 섹션 제목 목록"]
}

[분석할 문서]`;

function extname(filename) {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i).toLowerCase() : "";
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

/** 응답에 API 키 같은 비밀이 섞이지 않도록 */
function sanitizeDetail(s) {
  if (s == null) return "";
  return String(s).replace(/sk-ant-[a-zA-Z0-9\-_]{10,}/g, "[API_KEY_REDACTED]");
}

function anthropicErrToPayload(err) {
  const status = err?.status;
  const api = err?.error;
  const inner = api?.error;
  const type = inner?.type ?? api?.type ?? err?.type;
  const rawMsg = sanitizeDetail(
    inner?.message ?? api?.message ?? err?.message ?? String(err),
  );

  if (type === "authentication_error" || status === 401) {
    return {
      error:
        "Anthropic API 인증에 실패했습니다. Vercel 환경 변수 ANTHROPIC_API_KEY(Production)가 올바른지 확인하세요.",
      code: "ANTHROPIC_AUTH",
      detail: rawMsg || "invalid x-api-key 또는 키 누락",
      hint: "키 앞뒤 공백·따옴표 포함 여부, Production/Preview 환경 별도 설정 여부를 확인하세요.",
    };
  }

  if (type === "permission_error" || status === 403) {
    return {
      error: "Anthropic API 권한이 없습니다.",
      code: "ANTHROPIC_PERMISSION",
      detail: rawMsg,
    };
  }

  if (type === "rate_limit_error" || status === 429) {
    return {
      error: "Anthropic API 요청 한도에 걸렸습니다. 잠시 후 다시 시도해주세요.",
      code: "ANTHROPIC_RATE_LIMIT",
      detail: rawMsg,
    };
  }

  if (type === "not_found_error" || status === 404) {
    return {
      error: "요청한 모델 또는 리소스를 찾을 수 없습니다.",
      code: "ANTHROPIC_NOT_FOUND",
      detail: rawMsg,
      hint: `ANTHROPIC_MODEL을 비우거나 ${FALLBACK_MODEL} 등 지원 모델로 설정해 보세요.`,
    };
  }

  if (type === "invalid_request_error" || status === 400) {
    return {
      error: "Anthropic API 요청 형식이 올바르지 않습니다.",
      code: "ANTHROPIC_BAD_REQUEST",
      detail: rawMsg,
    };
  }

  if (type === "overloaded_error" || status === 529) {
    return {
      error: "Anthropic API가 과부하 상태입니다. 잠시 후 다시 시도해주세요.",
      code: "ANTHROPIC_OVERLOADED",
      detail: rawMsg,
    };
  }

  if (type === "billing_error") {
    return {
      error: "Anthropic 과금·크레딧 쪽 문제로 요청이 거절되었습니다.",
      code: "ANTHROPIC_BILLING",
      detail: rawMsg,
    };
  }

  return {
    error: "Claude API 호출 중 오류가 발생했습니다.",
    code: type || "ANTHROPIC_ERROR",
    detail: rawMsg,
    httpStatus: status,
  };
}

async function readRequestBodyBuffer(req) {
  if (Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === "string") {
    return Buffer.from(req.body, "utf8");
  }
  if (req.body instanceof Uint8Array) {
    return Buffer.from(req.body);
  }

  const chunks = [];
  await new Promise((resolve, reject) => {
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", resolve);
    req.on("error", reject);
  });
  return Buffer.concat(chunks);
}

function parseMultipartBuffer(buffer, headers) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({
      headers,
      limits: { fileSize: MAX_BYTES },
    });
    const files = [];

    bb.on("file", (fieldname, file, info) => {
      if (fieldname !== "file") {
        file.resume();
        return;
      }
      const chunks = [];
      file.on("data", (d) => chunks.push(d));
      file.on("limit", () => {
        reject(Object.assign(new Error("FILE_TOO_LARGE"), { code: "FILE_TOO_LARGE" }));
      });
      file.on("error", reject);
      file.on("end", () => {
        files.push({
          filename: info.filename,
          mimeType: info.mimeType,
          buffer: Buffer.concat(chunks),
        });
      });
    });

    bb.on("error", reject);
    bb.on("finish", () => resolve(files));
    Readable.from(buffer).pipe(bb);
  });
}

async function parseMultipart(req) {
  const buffer = await readRequestBodyBuffer(req);
  if (!buffer.length) {
    const err = new Error("EMPTY_MULTIPART_BODY");
    err.code = "EMPTY_BODY";
    throw err;
  }
  return parseMultipartBuffer(buffer, req.headers);
}

function parseErrorToMessage(parseResult) {
  const code = parseResult.code;
  const map = {
    ENCRYPTED: "암호화된 문서는 지원하지 않습니다.",
    DRM_PROTECTED: "DRM이 적용된 문서는 읽을 수 없습니다.",
    IMAGE_BASED_PDF:
      "이 PDF는 이미지 기반이라 텍스트를 추출할 수 없습니다. OCR이 필요합니다.",
    UNSUPPORTED_FORMAT: "지원하지 않는 파일 형식입니다.",
    CORRUPTED: "파일이 손상되었을 수 있습니다.",
  };
  if (code && map[code]) return map[code];
  return "파일을 읽을 수 없습니다. 파일이 손상되었을 수 있습니다.";
}

function clipForClaude(text) {
  if (text.length <= MAX_CLAUDE_INPUT_CHARS) return text;
  return (
    text.slice(0, MAX_CLAUDE_INPUT_CHARS) +
    "\n\n[… 이하 생략 — 문서가 길어 앞부분만 AI에 전달했습니다.]"
  );
}

async function callClaude(client, model, { system, user }, retries = 1) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const msg = await client.messages.create({
        model,
        max_tokens: 8192,
        ...(system ? { system } : {}),
        messages: [{ role: "user", content: user }],
      });
      const block = msg.content?.find((b) => b.type === "text");
      return block?.text ?? "";
    } catch (e) {
      lastErr = e;
      if (attempt < retries) continue;
      throw e;
    }
  }
  throw lastErr;
}

function extractJsonObject(text) {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1].trim() : trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("Invalid JSON from model");
  return JSON.parse(raw.slice(start, end + 1));
}

function logClaudeError(stage, err) {
  const status = err?.status;
  const type = err?.error?.error?.type ?? err?.error?.type;
  console.error(
    `[convert] ${stage}`,
    status ?? "",
    type ?? "",
    err?.message ?? err,
  );
}

async function callClaudeWithModelFallback(client, model, opts) {
  try {
    return await callClaude(client, model, opts);
  } catch (e) {
    const status = e?.status ?? e?.error?.status;
    const msg = String(e?.message ?? "").toLowerCase();
    const modelNotFound =
      status === 404 ||
      msg.includes("not_found_error") ||
      msg.includes("model:") ||
      msg.includes("invalid model");
    if (model !== FALLBACK_MODEL && modelNotFound) {
      console.warn("[convert] model fallback:", model, "→", FALLBACK_MODEL);
      return await callClaude(client, FALLBACK_MODEL, opts);
    }
    throw e;
  }
}

async function handleConvert(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed", code: "METHOD_NOT_ALLOWED" });
    return;
  }

  const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!apiKey) {
    sendJson(res, 500, {
      error: "서버에 ANTHROPIC_API_KEY가 설정되지 않았습니다.",
      code: "MISSING_ANTHROPIC_API_KEY",
      detail: "Vercel → Settings → Environment Variables 에서 Production 환경에도 추가했는지 확인하세요.",
    });
    return;
  }

  const model = (process.env.ANTHROPIC_MODEL || "").trim() || DEFAULT_MODEL;
  const client = new Anthropic({
    apiKey,
    timeout: 120_000,
  });

  let files;
  try {
    files = await parseMultipart(req);
  } catch (e) {
    if (e.code === "FILE_TOO_LARGE") {
      sendJson(res, 413, {
        error: "10MB 이하 파일만 업로드 가능합니다.",
        code: "FILE_TOO_LARGE",
      });
      return;
    }
    if (e.code === "EMPTY_BODY") {
      sendJson(res, 400, {
        error: "업로드 본문이 비어 있습니다.",
        code: "EMPTY_BODY",
        detail:
          "Vercel에서 multipart 스트림이 비어 있는 경우입니다. 네트워크/프록시 또는 요청 크기 제한을 확인하세요.",
      });
      return;
    }
    console.error("[convert] multipart_parse", e);
    sendJson(res, 400, {
      error: "요청 본문을 파싱할 수 없습니다.",
      code: "MULTIPART_PARSE_ERROR",
      detail: sanitizeDetail(e.message || String(e)),
    });
    return;
  }

  const file = files[0];
  if (!file?.buffer?.length) {
    sendJson(res, 400, {
      error: "파일이 없습니다.",
      code: "NO_FILE",
      detail:
        "폼 필드 이름은 file이어야 하며, multipart가 올바른지 확인하세요.",
    });
    return;
  }

  const ext = extname(file.filename || "");
  if (!ALLOWED_EXT.has(ext)) {
    sendJson(res, 400, {
      error: "HWP, HWPX, PDF 파일만 가능합니다.",
      code: "UNSUPPORTED_EXT",
    });
    return;
  }

  const u8 = new Uint8Array(file.buffer);
  let parsed;
  try {
    parsed = await parse(u8);
  } catch (e) {
    console.error("[convert] kordoc_throw", e);
    sendJson(res, 500, {
      error: "파일을 읽을 수 없습니다. 파일이 손상되었을 수 있습니다.",
      code: "KORDOC_EXCEPTION",
      detail: sanitizeDetail(e?.message || String(e)),
    });
    return;
  }

  if (!parsed.success) {
    sendJson(res, 500, {
      error: parseErrorToMessage(parsed),
      code: parsed.code || "KORDOC_PARSE_FAILED",
      detail: sanitizeDetail(parsed.error || ""),
    });
    return;
  }

  const rawText = (parsed.markdown || "").trim();
  if (!rawText) {
    sendJson(res, 500, {
      error: "파일을 읽을 수 없습니다. 파일이 손상되었을 수 있습니다.",
      code: "EMPTY_MARKDOWN",
    });
    return;
  }

  const textForClaude = clipForClaude(rawText);
  const analysisSystem =
    "당신은 문서 분석기입니다. 반드시 유효한 JSON만 출력하세요.";

  const mdPromise = callClaudeWithModelFallback(client, model, {
    user: `${CONVERT_PROMPT}\n\n${textForClaude}`,
  });
  const analysisPromise = callClaudeWithModelFallback(client, model, {
    system: analysisSystem,
    user: `${ANALYSIS_PROMPT}\n\n${textForClaude}`,
  });

  const settled = await Promise.allSettled([mdPromise, analysisPromise]);

  if (settled[0].status === "rejected") {
    const err = settled[0].reason;
    logClaudeError("claude_markdown", err);
    const payload = anthropicErrToPayload(err);
    sendJson(res, 500, payload);
    return;
  }

  if (settled[1].status === "rejected") {
    const err = settled[1].reason;
    logClaudeError("claude_analysis", err);
    const payload = anthropicErrToPayload(err);
    sendJson(res, 500, payload);
    return;
  }

  const markdownResult = settled[0].value;
  const analysisText = settled[1].value;

  let analysisResult;
  try {
    analysisResult = extractJsonObject(analysisText);
  } catch (e) {
    console.error("[convert] analysis_json_parse", e, analysisText?.slice?.(0, 400));
    sendJson(res, 500, {
      error: "분석 결과 JSON을 해석할 수 없습니다. 모델 응답 형식을 확인하세요.",
      code: "ANALYSIS_JSON_PARSE",
      detail: sanitizeDetail(e.message || String(e)),
      snippet: sanitizeDetail(analysisText?.slice?.(0, 800) || ""),
    });
    return;
  }

  const pageCount =
    analysisResult.page_count ??
    parsed.metadata?.pageCount ??
    parsed.pageCount;

  const analysis = {
    summary: analysisResult.summary ?? "",
    keywords: Array.isArray(analysisResult.keywords)
      ? analysisResult.keywords
      : [],
    structure: analysisResult.structure ?? "",
    tone: analysisResult.tone ?? "",
    key_sections: Array.isArray(analysisResult.key_sections)
      ? analysisResult.key_sections
      : [],
    ...(pageCount != null ? { page_count: pageCount } : {}),
  };

  sendJson(res, 200, {
    markdown: markdownResult || rawText,
    analysis,
  });
}

export default async function handler(req, res) {
  try {
    await handleConvert(req, res);
  } catch (e) {
    console.error("[convert] unhandled", e);
    sendJson(res, 500, {
      error: "서버 내부 오류가 발생했습니다.",
      code: "UNHANDLED",
      detail: sanitizeDetail(e?.message || String(e)),
    });
  }
}
