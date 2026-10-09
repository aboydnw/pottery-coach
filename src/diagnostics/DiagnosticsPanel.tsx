import type { DiagnosticSample } from "./FrameDiagnostics";

export function DiagnosticsPanel({ sample }: { sample: DiagnosticSample }) {
  return (
    <details className="diagnostics">
      <summary>Camera diagnostics</summary>
      <dl>
        <div><dt>Preview</dt><dd>{sample.previewFps} fps</dd></div>
        <div><dt>Processed</dt><dd>{sample.processedFps} fps</dd></div>
        <div><dt>Frame age p95</dt><dd>{sample.frameAgeMsP95} ms</dd></div>
        <div><dt>Dropped</dt><dd>{sample.droppedFrames}</dd></div>
      </dl>
    </details>
  );
}
