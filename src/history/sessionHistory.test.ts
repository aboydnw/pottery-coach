import { describe, expect, it } from "vitest";
import type { PieceRecord } from "../pieces/types";
import type { SessionRecord } from "../session/types";
import { buildSessionHistory } from "./sessionHistory";

function session(id: string, startedAtMs: number, endedAtMs: number | null): SessionRecord {
  return {
    id,
    schemaVersion: 2,
    startedAtMs,
    endedAtMs,
    goal: null,
    deviceClass: "phone",
    calibrationId: null,
    consent: {
      cameraLocal: true,
      cloudAudio: false,
      transcriptRetention: false,
      snapshotUpload: false,
      researchMedia: false,
      policyRevision: "test",
      grantedAtMs: startedAtMs,
    },
    outcome: endedAtMs ? "completed" : null,
  };
}

function piece(id: string, sessionId: string): PieceRecord {
  return {
    id,
    sessionId,
    index: 1,
    startedAtMs: 1,
    endedAtMs: 2,
    targetId: null,
    goalHeightMm: null,
    goalBasis: null,
    sizesAvailable: false,
    peakHeightMm: null,
    finalHeightMm: null,
    finalMaximumWidthMm: null,
    reachedGoalPercent: null,
    markedMoments: 0,
    notes: [],
    corrections: [],
    cues: [],
    usage: { inputTextTokens: 0, outputTextTokens: 0, inputAudioTokens: 0, outputAudioTokens: 0 },
    estimatedCostUsd: 0,
    updatedAtMs: 2,
    syncedAtMs: null,
  };
}

describe("buildSessionHistory", () => {
  it("lists sessions newest first with duration and grouped piece counts", () => {
    const items = buildSessionHistory(
      [session("older", 1_000, 61_000), session("newer", 120_000, 300_000)],
      [piece("a", "newer"), piece("b", "newer"), piece("c", "older")],
    );

    expect(items.map((item) => item.id)).toEqual(["newer", "older"]);
    expect(items[0]).toMatchObject({ durationMinutes: 3, pieceCount: 2, status: "Completed" });
    expect(items[1]).toMatchObject({ durationMinutes: 1, pieceCount: 1 });
  });

  it("describes a session without an end as interrupted", () => {
    expect(buildSessionHistory([session("open", 1_000, null)], [])[0]).toMatchObject({
      durationMinutes: null,
      pieceCount: 0,
      status: "Interrupted",
    });
  });
});
