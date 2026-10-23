import { useEffect, useState } from "react";
import { PieceLine } from "./HistoryPanel";
import type { ThrowLog } from "./ThrowLog";
import type { PieceRecord } from "./types";

/** The pots from one session on the review screen, each with a box for the potter's own notes. */
export function SessionPieces({ throwLog, sessionId }: { throwLog: ThrowLog; sessionId: string }) {
  const [pieces, setPieces] = useState<PieceRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    void throwLog.listPieces().then((list) => {
      if (!cancelled) setPieces(list.filter((piece) => piece.sessionId === sessionId).reverse());
    });
    return () => {
      cancelled = true;
    };
  }, [throwLog, sessionId]);

  async function addNote(id: string, text: string): Promise<void> {
    const updated = await throwLog.addNote(id, text);
    if (updated) setPieces((current) => current.map((piece) => (piece.id === id ? updated : piece)));
  }

  if (!pieces.length) return null;
  return (
    <section className="session-pieces" aria-labelledby="session-pieces-title">
      <h2 id="session-pieces-title">{pieces.length === 1 ? "Your piece" : `Your ${pieces.length} pieces`}</h2>
      <ol>
        {pieces.map((piece) => (
          <li key={piece.id}>
            <PieceLine piece={piece} />
            <NoteForm label={`Note for piece ${piece.index}`} onAdd={(text) => void addNote(piece.id, text)} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function NoteForm({ label, onAdd }: { label: string; onAdd(text: string): void }) {
  const [draft, setDraft] = useState("");
  return (
    <form
      className="note-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!draft.trim()) return;
        onAdd(draft.trim());
        setDraft("");
      }}
    >
      <label>
        {label}
        <input
          type="text"
          maxLength={500}
          placeholder="What happened inside the pot, what you'd change…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
      <button type="submit" className="secondary">
        Add note
      </button>
    </form>
  );
}
