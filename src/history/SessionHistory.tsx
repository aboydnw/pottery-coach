import type { SessionHistoryItem } from "./sessionHistory";

export function SessionHistory({
  sessions,
  onOpen,
}: {
  sessions: SessionHistoryItem[];
  onOpen(sessionId: string): void;
}) {
  return (
    <section className="session-history" aria-labelledby="past-sessions-title">
      <h2 id="past-sessions-title">Past sessions</h2>
      {sessions.length === 0 ? (
        <p className="empty-state">No past sessions yet. Your completed sessions will appear here.</p>
      ) : (
        <ol>
          {sessions.map((session) => (
            <li key={session.id}>
              <button type="button" className="session-history-card" onClick={() => onOpen(session.id)}>
                <span className="session-history-date">
                  {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
                    session.startedAtMs,
                  )}
                </span>
                <span className="session-history-meta">
                  <span>{session.status}</span>
                  {session.durationMinutes !== null && <span>{session.durationMinutes} min</span>}
                  <span>{session.pieceCount === 1 ? "1 piece" : `${session.pieceCount} pieces`}</span>
                </span>
                <span className="visually-hidden">Open session</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
