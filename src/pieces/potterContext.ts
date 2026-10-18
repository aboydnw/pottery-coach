import { MAX_POTTER_CONTEXT_LENGTH } from "../voice/instructions";
import { digestOf } from "./summarizePiece";
import type { LastingNote, PieceRecord } from "./types";

/** What the coach knows about the potter: their lasting notes, then a line about recent pieces. */
export function buildPotterContext(notes: LastingNote[], pieces: PieceRecord[]): string {
  const lines = notes.map((note) => `- ${note.text}`);
  const digest = digestOf(pieces);
  if (digest) lines.push(`- ${digest}`);
  return lines.join("\n").slice(0, MAX_POTTER_CONTEXT_LENGTH);
}
