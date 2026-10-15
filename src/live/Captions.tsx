import type { Caption } from "../voice/useVoiceSession";

const STATUS_TEXT: Record<string, string> = {
  off: "Voice coach is off",
  idle: "Voice coach is off",
  connecting: "Connecting to your coach…",
  connected: "Coach is listening",
  reconnecting: "Reconnecting…",
  paused: "Coach is paused",
  failed: "Voice coach couldn't connect",
  closed: "Voice coach ended",
};

/** Shows what the coach and potter just said, plus the connection state, for a quick glance. */
export function Captions({ state, captions }: { state: string; captions: Caption[] }) {
  return (
    <section className="captions" aria-label="Conversation">
      <p className="voice-status" role="status">
        {STATUS_TEXT[state] ?? state}
      </p>
      <ol aria-live="polite">
        {captions.map((caption) => (
          <li key={caption.id} className={caption.speaker === "assistant" ? "caption-coach" : "caption-you"}>
            <span className="caption-speaker">{caption.speaker === "assistant" ? "Coach" : "You"}:</span> {caption.text}
          </li>
        ))}
      </ol>
    </section>
  );
}
