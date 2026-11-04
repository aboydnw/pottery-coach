import { expect, it } from "vitest";

import { validateClayModelManifest } from "./modelManifest";

it("requires immutable model identity and a passing held-out evaluation", () => {
  expect(() =>
    validateClayModelManifest({
      schemaVersion: "clay-model-v1",
      modelVersion: "clay-1",
      datasetVersion: "dataset-1",
      sha256: "bad",
      inputSize: [256, 256],
      threshold: 0.5,
      promoted: true,
      evaluation: {
        intersectionOverUnion: 0.9,
        medianBoundaryErrorMm: 4,
        p95BoundaryErrorMm: 10,
        noClayFalsePositiveRate: 0.01,
        occlusionSuppressionRecall: 0.96,
        latencyP95Ms: 100,
      },
    }),
  ).toThrow(/sha-256/i);
});
