import { describe, expect, it } from "vitest";
import { buildSummary } from "./buildSummary";
import type { SessionBundle } from "../session/types";

const bundle: SessionBundle = {
  session: { id: "s", schemaVersion: 1, startedAtMs: 0, endedAtMs: 5_000, goal: null,
    deviceClass: "phone", calibrationId: "c", outcome: "completed",
    consent: { cameraLocal: true, cloudAudio: false, transcriptRetention: false,
      snapshotUpload: false, researchMedia: false, policyRevision: "1", grantedAtMs: 0 } },
  readings: [
    { id: "r1", sessionId: "s", timestampMs: 0, kind: "stable", values: { heightMm: 20 }, confidence: 0.9 },
    { id: "r2", sessionId: "s", timestampMs: 1_000, kind: "stable", values: { heightMm: 30 }, confidence: 0.4 },
    { id: "r3", sessionId: "s", timestampMs: 2_000, kind: "stable", values: { heightMm: 25 }, confidence: 0.9 },
  ], diagnostics: [], events: [], moments: [], transcripts: [],
};

describe("buildSummary", () => {
  it("uses only supported readings and carries evidence IDs", () => {
    expect(buildSummary(bundle)).toMatchObject({
      schemaVersion: 1, peak: { heightMm: 25, evidenceIds: ["r3"] },
      final: { heightMm: 25, evidenceIds: ["r3"] }, unmeasurableDurationMs: 1_000,
    });
  });
});
