import Busboy from "busboy";
import { parse } from "kordoc";
import Anthropic from "@anthropic-ai/sdk";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXT = new Set([".hwp", ".hwpx", ".pdf"]);

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

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({
      headers: req.headers,
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
    req.pipe(bb);
  });
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

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "서버에 ANTHROPIC_API_KEY가 설정되지 않았습니다." }));
    return;
  }

  const model =
    process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
  const client = new Anthropic({ apiKey });

  let files;
  try {
    files = await parseMultipart(req);
  } catch (e) {
    if (e.code === "FILE_TOO_LARGE") {
      res.statusCode = 413;
      res.end(JSON.stringify({ error: "10MB 이하 파일만 업로드 가능합니다." }));
      return;
    }
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "요청 본문을 파싱할 수 없습니다." }));
    return;
  }

  const file = files[0];
  if (!file?.buffer?.length) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "파일이 없습니다." }));
    return;
  }

  const ext = extname(file.filename || "");
  if (!ALLOWED_EXT.has(ext)) {
    res.statusCode = 400;
    res.end(
      JSON.stringify({ error: "HWP, HWPX, PDF 파일만 가능합니다." }),
    );
    return;
  }

  const u8 = new Uint8Array(file.buffer);
  let parsed;
  try {
    parsed = await parse(u8);
  } catch {
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error:
          "파일을 읽을 수 없습니다. 파일이 손상되었을 수 있습니다.",
      }),
    );
    return;
  }

  if (!parsed.success) {
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error: parseErrorToMessage(parsed),
      }),
    );
    return;
  }

  const rawText = (parsed.markdown || "").trim();
  if (!rawText) {
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error:
          "파일을 읽을 수 없습니다. 파일이 손상되었을 수 있습니다.",
      }),
    );
    return;
  }

  let markdownResult;
  let analysisResult;
  try {
    markdownResult = await callClaude(client, model, {
      user: `${CONVERT_PROMPT}\n\n${rawText}`,
    });
  } catch {
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error:
          "AI 분석 중 오류가 발생했습니다. 다시 시도해주세요.",
      }),
    );
    return;
  }

  try {
    const analysisText = await callClaude(client, model, {
      system: "당신은 문서 분석기입니다. 반드시 유효한 JSON만 출력하세요.",
      user: `${ANALYSIS_PROMPT}\n\n${rawText}`,
    });
    analysisResult = extractJsonObject(analysisText);
  } catch {
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error:
          "AI 분석 중 오류가 발생했습니다. 다시 시도해주세요.",
      }),
    );
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

  res.statusCode = 200;
  res.end(
    JSON.stringify({
      markdown: markdownResult || rawText,
      analysis,
    }),
  );
}
