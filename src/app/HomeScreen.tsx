import { SessionHistory } from "../history/SessionHistory";
import type { SessionHistoryItem } from "../history/sessionHistory";

export function HomeScreen({
  sessions,
  onStart,
  onAbout,
  onOpenSession,
}: {
  sessions: SessionHistoryItem[];
  onStart(): void;
  onAbout(): void;
  onOpenSession(sessionId: string): void;
}) {
  return (
    <section className="home-screen" aria-labelledby="home-title">
      <div className="home-hero">
        <p className="eyebrow">Voice-guided throwing</p>
        <h1 id="home-title">Ready at the wheel?</h1>
        <button type="button" className="start-button" onClick={onStart}>
          Start session
        </button>
      </div>
      <header className="page-header home-nav">
        <p className="wordmark">Pottery Coach</p>
        <button type="button" className="text-button" onClick={onAbout}>
          About
        </button>
      </header>
      <SessionHistory sessions={sessions} onOpen={onOpenSession} />
    </section>
  );
}
