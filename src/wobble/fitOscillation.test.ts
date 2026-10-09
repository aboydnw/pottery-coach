import { expect, it } from "vitest";

import { fitOscillation } from "./fitOscillation";

it("fits sinusoidal amplitude while ignoring a linear shaping trend", () => {
  const samples = Array.from({ length: 100 }, (_, index) => {
    const timestampMs = index * 50;
    return { timestampMs, value: 6 * Math.sin(2 * Math.PI * timestampMs / 1000) + index * 0.02, weight: 1 };
  });
  const fit = fitOscillation(samples, 1000);
  expect(fit.amplitudeMm).toBeCloseTo(6, 1);
  expect(fit.residualRmsMm).toBeLessThan(0.2);
});
