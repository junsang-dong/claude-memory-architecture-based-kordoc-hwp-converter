import { useCallback, useState } from "react";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set([".hwp", ".hwpx", ".pdf"]);

function extname(name) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export function useConvert() {
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const convert = useCallback(async (file) => {
    setError(null);
    setResult(null);

    if (!file) {
      setStatus("error");
      setError("파일을 선택해주세요.");
      return;
    }

    const ext = extname(file.name);
    if (!ALLOWED.has(ext)) {
      setStatus("error");
      setError("HWP, HWPX, PDF 파일만 가능합니다");
      return;
    }

    if (file.size > MAX_BYTES) {
      setStatus("error");
      setError("10MB 이하 파일만 업로드 가능합니다");
      return;
    }

    setStatus("loading");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });

      const rawText = await res.text();
      let data = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = {
          error: `서버 응답을 JSON으로 읽을 수 없습니다 (HTTP ${res.status})`,
          code: "BAD_RESPONSE",
          detail: rawText.slice(0, 800),
        };
      }

      if (!res.ok) {
        const lines = [
          data.error || `요청 실패 (HTTP ${res.status})`,
          data.code ? `코드: ${data.code}` : null,
          data.detail ? `상세: ${data.detail}` : null,
          data.hint ? `안내: ${data.hint}` : null,
          data.snippet ? `응답 일부: ${data.snippet}` : null,
        ].filter(Boolean);
        setError(lines.join("\n"));
        setStatus("error");
        return;
      }

      setResult(data);
      setStatus("success");
    } catch (e) {
      setError(
        e instanceof Error
          ? `네트워크 오류: ${e.message}`
          : "네트워크 연결을 확인해주세요",
      );
      setStatus("error");
    }
  }, []);

  return { convert, status, result, error };
}
