import { expect, it } from "vitest";
import { addUsage, estimateCostUsd } from "./pricing";

const usage = {
  inputTextTokens: 1_000_000,
  outputTextTokens: 0,
  inputAudioTokens: 1_000_000,
  outputAudioTokens: 1_000_000,
};

it("prices voice usage at the mini model's rates", () => {
  expect(estimateCostUsd(usage)).toBeCloseTo(0.6 + 10 + 20);
});

it("charges cached input at the cached rate", () => {
  expect(
    estimateCostUsd({ ...usage, cachedInputTextTokens: 1_000_000, cachedInputAudioTokens: 1_000_000 }),
  ).toBeCloseTo(0.06 + 0.3 + 20);
});

it("adds usage from several replies", () => {
  expect(addUsage(usage, { ...usage, cachedInputAudioTokens: 5 })).toMatchObject({
    inputAudioTokens: 2_000_000,
    cachedInputAudioTokens: 5,
  });
});
