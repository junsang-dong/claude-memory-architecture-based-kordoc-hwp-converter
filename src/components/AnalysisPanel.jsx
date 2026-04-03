export function AnalysisPanel({ analysis }) {
  if (!analysis) {
    return <p className="placeholder">문서 분석 결과가 여기에 표시됩니다.</p>;
  }

  const {
    summary,
    keywords = [],
    structure,
    tone,
    key_sections = [],
    page_count: pageCount,
  } = analysis;

  return (
    <div className="analysis-panel">
      {summary ? (
        <div className="analysis-row">
          <div className="analysis-label">요약</div>
          <div>{summary}</div>
        </div>
      ) : null}

      {keywords.length > 0 ? (
        <div className="analysis-row">
          <div className="analysis-label">키워드</div>
          <div className="tag-list">
            {keywords.map((k) => (
              <span key={k} className="tag">
                #{k}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {structure ? (
        <div className="analysis-row">
          <div className="analysis-label">문서 유형</div>
          <div>{structure}</div>
        </div>
      ) : null}

      {tone ? (
        <div className="analysis-row">
          <div className="analysis-label">톤</div>
          <div>{tone}</div>
        </div>
      ) : null}

      {pageCount != null ? (
        <div className="analysis-row">
          <div className="analysis-label">페이지 수</div>
          <div>{pageCount}</div>
        </div>
      ) : null}

      {key_sections.length > 0 ? (
        <div className="analysis-row">
          <div className="analysis-label">주요 섹션</div>
          <ul className="section-list">
            {key_sections.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
