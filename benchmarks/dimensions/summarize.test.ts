import { expect, it } from "vitest";
import { summarizeDimensions } from "./summarize";

it("fails each accuracy and support gate from actual distributions", () => {
  const summary = summarizeDimensions([
    { errorMm: -12, supported: true, accepted: true }, { errorMm: 2, supported: true, accepted: true },
    { errorMm: 8, supported: true, accepted: false }, { errorMm: null, supported: false, accepted: true },
  ]);
  expect(summary.gates).toMatchObject({ median: false, p95: false, bias: true, supportedAcceptance: false, unsupportedRejection: false });
});
