import { expect, it } from "vitest";
import { summarizeVoice } from "./summarize";

it("fails response and barge-in targets while reporting provider usage", () => {
  const summary = summarizeVoice([
    { responseMs: 2_000, bargeInMs: 400, toolRoundTripMs: 200, reconnectMs: 1_000, inputTokens: 10, outputTokens: 20, costUsd: 0.01 },
  ]);
  expect(summary.gates).toEqual({ responseP50: false, bargeIn: false });
  expect(summary.usage).toMatchObject({ inputTokens: 10, outputTokens: 20, costUsd: 0.01 });
});
