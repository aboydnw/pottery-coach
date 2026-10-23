import { expect, it } from "vitest";
import type { RecordedReading, SessionBundle } from "../session/types";
import { digestOf, summarizePiece } from "./summarizePiece";
import { EMPTY_USAGE, type PieceRecord } from "./types";

function reading(timestampMs: number, heightMm: number): RecordedReading {
  return {
    id: `r${timestampMs}`,
    sessionId: "s1",
    timestampMs,
    kind: "stable",
    unit: "mm",
    values: { heightMm, maximumWidthMm: 80, rimWidthMm: 70, baseWidthMm: 75 },
    confidence: 0.9,
  };
}

const bundle = {
  session: { id: "s1", startedAtMs: 0, endedAtMs: 3_000 },
  readings: [reading(100, 60), reading(900, 150), reading(1_500, 40), reading(2_500, 90)],
  diagnostics: [],
  events: [],
  moments: [{ id: "m1", sessionId: "s1", timestampMs: 2_000, label: "first pull", stillBlobId: null, localOnly: true }],
  transcripts: [],
} as unknown as SessionBundle;

const setup = { targetId: "straight-cylinder-v1", goalHeightMm: 100, goalBasis: "wet" as const };

it("summarises only what was recorded while the piece was on the wheel", () => {
  const first = summarizePiece(bundle, { startedAtMs: 0, endedAtMs: 1_000 }, setup);
  const second = summarizePiece(bundle, { startedAtMs: 1_001, endedAtMs: 3_000 }, setup);
  expect(first).toMatchObject({ peakHeightMm: 150, finalHeightMm: 150, reachedGoalPercent: 150, markedMoments: 0 });
  expect(second).toMatchObject({ peakHeightMm: 90, finalHeightMm: 90, reachedGoalPercent: 90, markedMoments: 1 });
});

it("marks a piece with no sizes as shape-only", () => {
  const empty = { ...bundle, readings: [] } as SessionBundle;
  expect(summarizePiece(empty, { startedAtMs: 0, endedAtMs: 3_000 }, setup)).toMatchObject({
    sizesAvailable: false,
    reachedGoalPercent: null,
  });
});

function piece(index: number, reachedGoalPercent: number | null, note?: string): PieceRecord {
  return {
    id: `p${index}`,
    sessionId: "s1",
    index,
    startedAtMs: index,
    endedAtMs: index + 1,
    targetId: index % 2 ? "straight-cylinder-v1" : "tapered-cylinder-v1",
    goalHeightMm: 100,
    goalBasis: "wet",
    sizesAvailable: true,
    peakHeightMm: null,
    finalHeightMm: null,
    finalMaximumWidthMm: null,
    reachedGoalPercent,
    markedMoments: 0,
    notes: note ? [{ atMs: index, text: note }] : [],
    corrections: [],
    cues: [],
    usage: EMPTY_USAGE,
    estimatedCostUsd: 0,
    updatedAtMs: index,
    syncedAtMs: null,
  };
}

it("digests recent pieces into one short line for the coach", () => {
  expect(digestOf([piece(3, 90, "rim cracked"), piece(2, 100), piece(1, null, "older note")])).toBe(
    'Last 3 pieces: 2 straight cylinder, 1 tapered cylinder; average 95% of goal height; latest note: "rim cracked".',
  );
  expect(digestOf([])).toBeNull();
});
