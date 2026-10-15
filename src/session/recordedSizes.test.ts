import { expect, it } from "vitest";
import { resolveRecordedSizes, sizesUnavailable } from "./recordedSizes";
import type { SessionBundle } from "./types";

const base: SessionBundle = {
  session: {
    id: "s",
    schemaVersion: 2,
    startedAtMs: 0,
    endedAtMs: 1,
    goal: null,
    deviceClass: "phone",
    calibrationId: null,
    outcome: "completed",
    consent: {
      cameraLocal: true,
      cloudAudio: false,
      transcriptRetention: false,
      snapshotUpload: false,
      researchMedia: false,
      policyRevision: "1",
      grantedAtMs: 0,
    },
  },
  readings: [
    {
      id: "a",
      sessionId: "s",
      timestampMs: 0,
      kind: "stable",
      unit: "px",
      values: { height: 400, maximumWidth: 200, rimWidth: null, baseWidth: 150 },
      confidence: 0.9,
    },
    { id: "b", sessionId: "s", timestampMs: 1, kind: "stable", values: { heightMm: 90 }, confidence: 0.9 },
  ],
  diagnostics: [],
  events: [],
  moments: [],
  transcripts: [],
};

it("converts pixel readings with a scale set after they were recorded", () => {
  const bundle = {
    ...base,
    session: {
      ...base.session,
      scale: {
        mmPerPixel: 0.25,
        method: "wheel-head" as const,
        calibrationId: "c",
        estimatedErrorMm95: 1,
        confirmedAtMs: 5,
      },
    },
  };
  const resolved = resolveRecordedSizes(bundle);
  expect(resolved.readings[0]!.values).toMatchObject({
    heightMm: 100,
    maximumWidthMm: 50,
    rimWidthMm: null,
    baseWidthMm: 37.5,
  });
  expect(resolved.readings[1]!.values).toEqual({ heightMm: 90 });
  expect(sizesUnavailable(bundle)).toBe(false);
});

it("leaves sizes empty, rather than guessing, when the session never got a scale", () => {
  expect(resolveRecordedSizes(base).readings[0]!.values.heightMm).toBeNull();
  expect(sizesUnavailable(base)).toBe(true);
});

it("passes through readings that were already recorded in millimetres", () => {
  const bundle = {
    ...base,
    readings: [
      {
        id: "m",
        sessionId: "s",
        timestampMs: 0,
        kind: "stable" as const,
        unit: "mm" as const,
        values: { height: 120, maximumWidth: 92, rimWidth: null, baseWidth: null },
        confidence: 0.95,
      },
    ],
  };
  expect(resolveRecordedSizes(bundle).readings[0]!.values).toMatchObject({ heightMm: 120, maximumWidthMm: 92 });
});
