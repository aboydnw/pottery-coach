import type { LastingNote } from "./types";

/** What the coach remembers about the potter across sessions, with a way to remove each note. */
export function NotesPanel({ notes, onForget }: { notes: LastingNote[]; onForget(id: string): void }) {
  return (
    <section className="notes" aria-labelledby="notes-title">
      <h2 id="notes-title">What the coach remembers</h2>
      {notes.length === 0 ? (
        <p>Nothing yet. Tell the coach things like "I'm working on thinner walls".</p>
      ) : (
        <ul className="notes-list">
          {notes.map((note) => (
            <li key={note.id}>
              <span>{note.text}</span>
              <button type="button" className="link-button" onClick={() => onForget(note.id)}>
                Forget <span className="visually-hidden">"{note.text}"</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
