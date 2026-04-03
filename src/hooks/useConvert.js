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

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(
          data.error ||
            "AI 분석 중 오류가 발생했습니다. 다시 시도해주세요.",
        );
        setStatus("error");
        return;
      }

      setResult(data);
      setStatus("success");
    } catch {
      setError("네트워크 연결을 확인해주세요");
      setStatus("error");
    }
  }, []);

  return { convert, status, result, error };
}
