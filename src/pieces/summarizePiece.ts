import { buildSummary } from "../review/buildSummary";
import type { SessionBundle } from "../session/types";
import { TARGET_NAMES } from "../setup/setupSlots";
import type { PieceOutcome } from "./ThrowLog";
import type { PieceRecord } from "./types";

type Setup = Pick<PieceOutcome, "targetId" | "goalHeightMm" | "goalBasis">;

/**
 * Summarises one piece from a session recording whose sizes are already resolved to millimetres
 * (see `resolveRecordedSizes`), using only what was recorded while that piece was on the wheel.
 */
export function summarizePiece(
  bundle: SessionBundle,
  window: { startedAtMs: number; endedAtMs: number },
  setup: Setup,
): PieceOutcome {
  const inside = <T extends { timestampMs: number }>(items: T[]) =>
    items.filter((item) => item.timestampMs >= window.startedAtMs && item.timestampMs <= window.endedAtMs);
  const summary = buildSummary({
    ...bundle,
    readings: inside(bundle.readings),
    events: inside(bundle.events),
    moments: inside(bundle.moments),
  });
  const finalHeightMm = summary.final.heightMm;
  return {
    ...setup,
    endedAtMs: window.endedAtMs,
    sizesAvailable: summary.peak.heightMm !== null,
    peakHeightMm: summary.peak.heightMm,
    finalHeightMm,
    finalMaximumWidthMm: summary.final.maximumWidthMm,
    reachedGoalPercent:
      finalHeightMm !== null && setup.goalHeightMm ? Math.round((finalHeightMm / setup.goalHeightMm) * 100) : null,
    markedMoments: inside(bundle.moments).length,
  };
}

const DIGEST_PIECES = 5;

/** One short line about recent pieces for the coach's memory, or null before the first piece. */
export function digestOf(pieces: PieceRecord[]): string | null {
  const recent = pieces.filter((piece) => piece.endedAtMs !== null).slice(0, DIGEST_PIECES);
  if (!recent.length) return null;
  const shapes = new Map<string, number>();
  for (const piece of recent) {
    const name = (piece.targetId && TARGET_NAMES[piece.targetId]) ?? "other shape";
    shapes.set(name, (shapes.get(name) ?? 0) + 1);
  }
  const parts = [
    `Last ${recent.length} piece${recent.length === 1 ? "" : "s"}: ${[...shapes].map(([name, count]) => `${count} ${name}`).join(", ")}`,
  ];
  const reached = recent.flatMap((piece) => (piece.reachedGoalPercent === null ? [] : [piece.reachedGoalPercent]));
  if (reached.length) {
    parts.push(
      `average ${Math.round(reached.reduce((sum, value) => sum + value, 0) / reached.length)}% of goal height`,
    );
  }
  const latestNote = recent.find((piece) => piece.notes.length)?.notes.at(-1);
  if (latestNote) parts.push(`latest note: "${latestNote.text.slice(0, 80)}"`);
  return `${parts.join("; ")}.`;
}
