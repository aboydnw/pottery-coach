import { useEffect, useState } from "react";

import type { RealtimeCoachTransport } from "./types";

export function VoiceControls({ transport }: { transport: RealtimeCoachTransport }) {
  const [paused, setPaused] = useState(false);
  const [ended, setEnded] = useState(false);
  const [caption, setCaption] = useState("");
  const [bargeInLatencyMs, setBargeInLatencyMs] = useState<number | null>(null);

  useEffect(() => transport.onEvent((event) => {
    if (event.type === "speech-started") {
      const started = performance.now();
      void transport.cancelOutput("barge-in").finally(() => setBargeInLatencyMs(performance.now() - started));
    }
    if (event.type === "transcript-delta" || event.type === "transcript-final") setCaption(event.text);
  }), [transport]);

  async function togglePause(): Promise<void> {
    if (paused) await transport.resumeInput();
    else await transport.pauseInput();
    setPaused(!paused);
  }

  async function end(): Promise<void> {
    await transport.close();
    setEnded(true);
  }

  if (ended) return <p role="status">Voice session ended. Local camera measurements continue.</p>;
  return (
    <section className="voice-controls" aria-labelledby="voice-title">
      <h2 id="voice-title">Voice coach</h2>
      <p aria-live="polite">{caption || "Captions will appear here."}</p>
      <p>Microphone: {paused ? "paused" : "listening"} · Cloud: connected</p>
      {bargeInLatencyMs !== null && <p className="diagnostic-note">Last interruption: {Math.round(bargeInLatencyMs)} ms</p>}
      <div className="actions">
        <button type="button" onClick={togglePause}>{paused ? "Resume listening" : "Pause listening"}</button>
        <button type="button" className="secondary" onClick={end}>End voice</button>
      </div>
    </section>
  );
}
