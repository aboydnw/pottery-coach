import { expect, it } from "vitest";

import { assertDisjointSessions, passesClayModelGate, summarizeClaySegmentation } from "./metrics";

const passing = {
  intersectionOverUnion: 0.86,
  medianBoundaryErrorMm: 5,
  p95BoundaryErrorMm: 12,
  noClayFalsePositiveRate: 0.01,
  occlusionSuppressionRecall: 0.96,
  latencyP95Ms: 140,
};

it("does not promote a model that misses the no-clay false-positive gate", () => {
  expect(passesClayModelGate({ ...passing, noClayFalsePositiveRate: 0.021 })).toBe(false);
  expect(passesClayModelGate(passing)).toBe(true);
});

it("finds session identities shared by training and evaluation", () => {
  expect(assertDisjointSessions(["a", "b"], ["b", "c"])).toEqual(["b"]);
  expect(assertDisjointSessions(["a"], ["b"])).toEqual([]);
});

it("summarizes overlap, boundary, empty-scene, occlusion, and latency evidence", () => {
  const summary = summarizeClaySegmentation([
    {
      truth: new Uint8Array([0, 1, 1, 0]),
      predicted: new Uint8Array([0, 1, 0, 0]),
      boundaryErrorsMm: [2, 4],
      noClay: false,
      occludedFraction: 0.4,
      measurementSuppressed: true,
      latencyMs: 100,
    },
    {
      truth: new Uint8Array([0, 0, 0, 0]),
      predicted: new Uint8Array([0, 0, 0, 0]),
      boundaryErrorsMm: [],
      noClay: true,
      occludedFraction: 0,
      measurementSuppressed: true,
      latencyMs: 120,
    },
  ]);
  expect(summary.intersectionOverUnion).toBe(0.5);
  expect(summary.noClayFalsePositiveRate).toBe(0);
  expect(summary.occlusionSuppressionRecall).toBe(1);
  expect(summary.latencyP95Ms).toBe(120);
});
