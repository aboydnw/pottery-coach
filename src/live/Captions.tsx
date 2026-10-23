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
const FAILURE_TEXT: Record<string, string> = {
  unauthorized: "The voice coach isn't available for this account. Carry on by touch.",
  disabled: "The voice coach is switched off on the server.",
  unavailable: "Voice coach lost.",
  "time-limit": "Voice coach hung up after an hour.",
};

export function Captions({
  state,
  failure = null,
  captions,
}: {
  state: string;
  failure?: string | null;
  captions: Caption[];
}) {
  return (
    <section className="captions" aria-label="Conversation">
      <p className="voice-status" role="status">
        {(failure && FAILURE_TEXT[failure]) ?? STATUS_TEXT[state] ?? state}
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
