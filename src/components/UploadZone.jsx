import { useCallback, useRef, useState } from "react";

export function UploadZone({ onFile, disabled }) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (fileList) => {
      const file = fileList?.[0];
      if (file && onFile) onFile(file);
    },
    [onFile],
  );

  const onDragOver = (e) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    handleFiles(e.dataTransfer?.files);
  };

  const onClick = () => {
    if (!disabled) inputRef.current?.click();
  };

  const onChange = (e) => {
    handleFiles(e.target.files);
    e.target.value = "";
  };

  return (
    <div
      className={`upload-zone${isDragging ? " dragging" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".hwp,.hwpx,.pdf,application/pdf,application/x-hwp,application/haansofthwp"
        className="sr-only"
        onChange={onChange}
        disabled={disabled}
      />
      <span className="emoji" aria-hidden>
        📄
      </span>
      <strong>HWP · HWPX · PDF 파일을 여기에 드래그하거나 클릭</strong>
      <p>로컬에서만 처리 경로가 열리며, 서버로 업로드됩니다.</p>
      <p className="upload-hint">최대 10MB · 형식: .hwp, .hwpx, .pdf</p>
    </div>
  );
}
