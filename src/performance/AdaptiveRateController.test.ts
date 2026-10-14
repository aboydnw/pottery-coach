import { expect, it } from "vitest";
import { AdaptiveRateController } from "./AdaptiveRateController";

it("steps the processing rate down under load and back up on recovery", () => {
  const changes: number[] = [];
  const controller = new AdaptiveRateController((mode) => changes.push(mode.processingHz));
  expect(controller.update({ processingMsP95: 130, frameAgeMsP95: 600 })).toMatchObject({ processingHz: 7.5, reason: "latency-pressure" });
  expect(controller.update({ processingMsP95: 210, frameAgeMsP95: 900 }).processingHz).toBe(5);
  expect(controller.update({ processingMsP95: 20, frameAgeMsP95: 100 }).processingHz).toBe(7.5);
  expect(changes).toEqual([7.5, 5, 7.5]);
});
