import { expect, it } from "vitest";

import { estimatePeriod } from "./period";

it.each([400, 700, 1000, 1500, 2500])("estimates a %s ms irregular sampled period within five percent", (periodMs) => {
  const samples = Array.from({ length: 180 }, (_, index) => {
    const timestampMs = index * 47 + (index % 5) * 3;
    return { timestampMs, value: 5 * Math.sin(2 * Math.PI * timestampMs / periodMs) + (index % 3 - 1) * 0.05 };
  }).filter((_, index) => index % 11 !== 0);
  const estimate = estimatePeriod(samples, { minMs: 300, maxMs: 3000 });
  expect(estimate?.periodMs).toBeCloseTo(periodMs, -1);
  expect(Math.abs(estimate!.periodMs - periodMs) / periodMs).toBeLessThanOrEqual(0.05);
});

it("returns null for a monotonic non-periodic signal", () => {
  const samples = Array.from({ length: 100 }, (_, index) => ({ timestampMs: index * 50, value: index * 0.1 }));
  expect(estimatePeriod(samples, { minMs: 300, maxMs: 3000 })).toBeNull();
});
