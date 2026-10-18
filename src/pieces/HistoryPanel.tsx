import { useEffect, useState } from "react";
import { TARGET_NAMES } from "../setup/setupSlots";
import type { ThrowLog } from "./ThrowLog";
import type { PieceRecord } from "./types";

const dateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

/** The throw log, newest first: one line per pot, with its notes and size checks underneath. */
export function HistoryPanel({ throwLog, refreshKey = 0 }: { throwLog: ThrowLog; refreshKey?: number }) {
  const [pieces, setPieces] = useState<PieceRecord[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void throwLog
      .listPieces()
      .then((list) => !cancelled && setPieces(list))
      .catch(() => !cancelled && setPieces([]));
    return () => {
      cancelled = true;
    };
  }, [throwLog, refreshKey]);

  return (
    <section className="history" aria-labelledby="history-title">
      <h2 id="history-title">History</h2>
      {pieces === null ? (
        <p>Loading…</p>
      ) : pieces.length === 0 ? (
        <p>No pieces yet. Each pot you throw is added here.</p>
      ) : (
        <ol className="history-list">
          {pieces.map((piece) => (
            <li key={piece.id}>
              <PieceLine piece={piece} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function PieceLine({ piece }: { piece: PieceRecord }) {
  const shape = (piece.targetId && TARGET_NAMES[piece.targetId]) ?? "pot";
  const parts = [`${dateFormat.format(piece.startedAtMs)} · ${shape}`];
  if (piece.finalHeightMm !== null) parts.push(`${(piece.finalHeightMm / 10).toFixed(1)} cm tall`);
  if (piece.reachedGoalPercent !== null) parts.push(`${piece.reachedGoalPercent}% of goal`);
  if (piece.endedAtMs) parts.push(`${Math.max(1, Math.round((piece.endedAtMs - piece.startedAtMs) / 60_000))} min`);
  if (piece.estimatedCostUsd > 0) parts.push(`voice ~$${piece.estimatedCostUsd.toFixed(2)}`);
  return (
    <>
      <span>{parts.join(" · ")}</span>
      {(piece.notes.length > 0 || piece.corrections.length > 0) && (
        <ul className="piece-details">
          {piece.notes.map((note) => (
            <li key={`note-${note.atMs}`}>“{note.text}”</li>
          ))}
          {piece.corrections.map((correction) => (
            <li key={`correction-${correction.atMs}`}>
              You measured {correction.dimension} {(correction.trueMm / 10).toFixed(1)} cm; the app read{" "}
              {correction.appMm === null ? "nothing" : `${(correction.appMm / 10).toFixed(1)} cm`}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
