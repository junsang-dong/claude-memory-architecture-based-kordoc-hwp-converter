import { useConvert } from "./hooks/useConvert.js";
import { UploadZone } from "./components/UploadZone.jsx";
import { StatusBar } from "./components/StatusBar.jsx";
import { MarkdownViewer } from "./components/MarkdownViewer.jsx";
import { AnalysisPanel } from "./components/AnalysisPanel.jsx";

function App() {
  const { convert, status, result, error } = useConvert();

  return (
    <div className="app">
      <header className="app-header">
        <h1>🗂 HWP Analyzer</h1>
        <a
          className="help-link"
          href="https://github.com/chrisryugj/kordoc"
          target="_blank"
          rel="noreferrer"
        >
          kordoc · 참고
        </a>
      </header>

      <UploadZone
        onFile={(file) => convert(file)}
        disabled={status === "loading"}
      />

      <StatusBar status={status} error={error} />

      <div className="panels">
        <section className="panel" aria-labelledby="md-heading">
          <div id="md-heading" className="panel-header">
            📝 마크다운 변환
          </div>
          <div className="panel-body">
            <MarkdownViewer markdown={result?.markdown} />
          </div>
        </section>
        <section className="panel" aria-labelledby="an-heading">
          <div id="an-heading" className="panel-header">
            🔍 문서 분석
          </div>
          <div className="panel-body">
            <AnalysisPanel analysis={result?.analysis} />
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
