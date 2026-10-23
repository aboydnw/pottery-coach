import { expect, it } from "vitest";
import { summarizeDimensions } from "./summarize";

it("fails each accuracy and support gate from actual distributions", () => {
  const summary = summarizeDimensions([
    { errorMm: -12, supported: true, accepted: true },
    { errorMm: 2, supported: true, accepted: true },
    { errorMm: 8, supported: true, accepted: false },
    { errorMm: null, supported: false, accepted: true },
  ]);
  expect(summary.gates).toMatchObject({
    median: false,
    p95: false,
    bias: true,
    supportedAcceptance: false,
    unsupportedRejection: false,
  });
});

it("reports every input by camera angle including rejected and unmeasurable cases", () => {
  const summary = summarizeDimensions([
    { errorMm: 1, supported: true, accepted: true, angleDeg: 20 },
    { errorMm: null, supported: true, accepted: false, angleDeg: 20 },
    { errorMm: null, supported: false, accepted: false, angleDeg: 80 },
  ]);
  expect(summary.byAngle).toEqual([
    { angleDeg: 20, cases: 2, measurable: 1, accepted: 1, medianAbsErrorMm: 1 },
    { angleDeg: 80, cases: 1, measurable: 0, accepted: 0, medianAbsErrorMm: null },
  ]);
});
