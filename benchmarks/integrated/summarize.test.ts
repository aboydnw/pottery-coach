import { expect, it } from "vitest";
import { summarizeIntegrated } from "./summarize";

it("requires bounded queues, frame age, rate retention, and no monotonic memory growth", () => {
  const summary = summarizeIntegrated({ cameraOnlyHz: 10, integratedHz: 7, frameAgesMs: [100, 600],
    pendingFrames: [0, 2], recorderQueue: [0, 101], memoryBytes: [1, 2, 3, 4] });
  expect(summary.gates).toEqual({ rateRetention: false, frameAge: false, pendingFrames: false, recorderQueue: false, memory: false });
});
