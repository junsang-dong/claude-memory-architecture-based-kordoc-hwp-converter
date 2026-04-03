export function StatusBar({ status, error }) {
  if (status === "idle") {
    return (
      <div className="status-bar">
        <p className="status-message">
          파일을 업로드하면 변환과 분석이 시작됩니다.
        </p>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="status-bar">
        <p className="status-message">변환 중… 잠시만 기다려 주세요.</p>
        <div
          className="progress-track progress-indeterminate"
          role="progressbar"
          aria-busy="true"
          aria-label="처리 중"
        >
          <div className="progress-fill progress-fill-animated" />
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="status-bar">
        <p className="status-message error">{error}</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="status-bar">
        <p className="status-message success">완료되었습니다.</p>
      </div>
    );
  }

  return null;
}
