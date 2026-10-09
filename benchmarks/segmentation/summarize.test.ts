import { expect, it } from "vitest";
import { summarizeSegmentation } from "./summarize";

it("reports boundary and occlusion-unmeasurable gates independently", () => {
  const summary = summarizeSegmentation([
    { boundaryErrorMm: 2, occlusionFraction: 0.1, measurable: true },
    { boundaryErrorMm: 12, occlusionFraction: 0.4, measurable: true },
  ]);
  expect(summary.gates.p95Boundary).toBe(false);
  expect(summary.gates.occlusionUnmeasurableRecall).toBe(false);
});
