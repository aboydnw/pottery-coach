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

function completeEvidence() {
  return [
    {
      truth: new Uint8Array([0, 1, 1, 0]),
      predicted: new Uint8Array([0, 1, 1, 0]),
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
  ];
}

it("accepts a complete evaluation with passing measured results", () => {
  const summary = summarizeClaySegmentation(completeEvidence());
  expect(summary).toEqual({
    intersectionOverUnion: 1,
    medianBoundaryErrorMm: 2,
    p95BoundaryErrorMm: 4,
    noClayFalsePositiveRate: 0,
    occlusionSuppressionRecall: 1,
    latencyP95Ms: 120,
  });
  expect(passesClayModelGate(summary)).toBe(true);
});

it("requires no-clay scenes instead of assuming zero false positives", () => {
  expect(() => summarizeClaySegmentation(completeEvidence().filter((sample) => !sample.noClay))).toThrow();
});

it("requires occlusion above thirty percent instead of assuming suppression recall", () => {
  const samples = completeEvidence();
  samples[0]!.occludedFraction = 0.3;
  expect(() => summarizeClaySegmentation(samples)).toThrow();
  samples[1]!.occludedFraction = 0.8;
  expect(() => summarizeClaySegmentation(samples)).toThrow();
});

it("requires measured clay boundaries instead of assuming zero boundary error", () => {
  const samples = completeEvidence();
  samples[0]!.boundaryErrorsMm = [];
  expect(() => summarizeClaySegmentation(samples)).toThrow();
  samples[1]!.boundaryErrorsMm = [0];
  expect(() => summarizeClaySegmentation(samples)).toThrow();
});

it("requires foreground truth instead of awarding empty masks perfect overlap", () => {
  const samples = completeEvidence();
  samples[0]!.truth.fill(0);
  samples[0]!.predicted.fill(0);
  expect(() => summarizeClaySegmentation(samples)).toThrow();
});

it("rejects empty evaluations, empty masks, and mismatched mask dimensions", () => {
  expect(() => summarizeClaySegmentation([])).toThrow();
  const samples = completeEvidence();
  samples[0]!.truth = new Uint8Array();
  expect(() => summarizeClaySegmentation(samples)).toThrow();
  samples[0]!.predicted = new Uint8Array();
  expect(() => summarizeClaySegmentation(samples)).toThrow();
});

it("rejects no-clay labels that contradict foreground truth", () => {
  const samples = completeEvidence();
  samples[1]!.truth[0] = 1;
  expect(() => summarizeClaySegmentation(samples)).toThrow();
});

it.each([NaN, Infinity, -Infinity, -1])("rejects invalid measurements (%s)", (invalid) => {
  const badBoundary = completeEvidence();
  badBoundary[0]!.boundaryErrorsMm = [2, invalid];
  expect(() => summarizeClaySegmentation(badBoundary)).toThrow();
  const badLatency = completeEvidence();
  badLatency[0]!.latencyMs = invalid;
  expect(() => summarizeClaySegmentation(badLatency)).toThrow();
  const badOcclusion = completeEvidence();
  badOcclusion[0]!.occludedFraction = invalid;
  expect(() => summarizeClaySegmentation(badOcclusion)).toThrow();
});

it("rejects occlusion fractions greater than one", () => {
  const samples = completeEvidence();
  samples[0]!.occludedFraction = 1.01;
  expect(() => summarizeClaySegmentation(samples)).toThrow();
});

it.each(Object.keys(passing) as (keyof typeof passing)[])("rejects non-finite or negative %s at the gate", (key) => {
  for (const invalid of [NaN, Infinity, -Infinity, -1]) {
    expect(passesClayModelGate({ ...passing, [key]: invalid })).toBe(false);
  }
});

it("rejects impossible rates and reversed boundary percentiles", () => {
  expect(passesClayModelGate({ ...passing, intersectionOverUnion: 1.01 })).toBe(false);
  expect(passesClayModelGate({ ...passing, occlusionSuppressionRecall: 1.01 })).toBe(false);
  expect(passesClayModelGate({ ...passing, medianBoundaryErrorMm: 6, p95BoundaryErrorMm: 5 })).toBe(false);
});

it.each([
  ["intersectionOverUnion", 0.849],
  ["medianBoundaryErrorMm", 6.01],
  ["p95BoundaryErrorMm", 12.71],
  ["noClayFalsePositiveRate", 0.0201],
  ["occlusionSuppressionRecall", 0.949],
  ["latencyP95Ms", 150],
] as const)("preserves the %s promotion threshold", (key, failing) => {
  expect(passesClayModelGate({ ...passing, [key]: failing })).toBe(false);
});

it("counts false positives and unsuppressed occlusions rather than just requiring coverage", () => {
  const samples = completeEvidence();
  samples[0]!.measurementSuppressed = false;
  samples[1]!.predicted[0] = 1;
  const summary = summarizeClaySegmentation(samples);
  expect(summary.noClayFalsePositiveRate).toBe(1);
  expect(summary.occlusionSuppressionRecall).toBe(0);
  expect(summary.intersectionOverUnion).toBe(2 / 3);
  expect(passesClayModelGate(summary)).toBe(false);
});

it("preserves the exact inclusive accuracy gates and exclusive latency limit", () => {
  const limits = {
    intersectionOverUnion: 0.85,
    medianBoundaryErrorMm: 6,
    p95BoundaryErrorMm: 12.7,
    noClayFalsePositiveRate: 0.02,
    occlusionSuppressionRecall: 0.95,
    latencyP95Ms: 149.999,
  };
  expect(passesClayModelGate(limits)).toBe(true);
  expect(passesClayModelGate({ ...limits, latencyP95Ms: 150 })).toBe(false);
});
