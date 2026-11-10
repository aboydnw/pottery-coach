import type { PieceRecord } from "../pieces/types";
import type { SessionRecord } from "../session/types";

export type SessionHistoryItem = {
  id: string;
  startedAtMs: number;
  durationMinutes: number | null;
  pieceCount: number;
  status: "Completed" | "Interrupted" | "Failed";
};

export function buildSessionHistory(sessions: SessionRecord[], pieces: PieceRecord[]): SessionHistoryItem[] {
  const pieceCounts = new Map<string, number>();
  for (const piece of pieces) pieceCounts.set(piece.sessionId, (pieceCounts.get(piece.sessionId) ?? 0) + 1);

  return [...sessions]
    .sort((left, right) => right.startedAtMs - left.startedAtMs)
    .map((session) => ({
      id: session.id,
      startedAtMs: session.startedAtMs,
      durationMinutes:
        session.endedAtMs === null ? null : Math.max(1, Math.round((session.endedAtMs - session.startedAtMs) / 60_000)),
      pieceCount: pieceCounts.get(session.id) ?? 0,
      status: session.outcome === "failed" ? "Failed" : session.endedAtMs === null ? "Interrupted" : "Completed",
    }));
}
