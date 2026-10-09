import { expect, it } from "vitest";
import { MilestoneTracker } from "./milestones";

it("emits configured milestones once and rearms only below hysteresis", () => {
  const tracker = new MilestoneTracker([0.8, 0.95, 1], 0.02);
  expect(tracker.update(0.81)).toEqual([80]);
  expect(tracker.update(0.79)).toEqual([]);
  expect(tracker.update(0.81)).toEqual([]);
  tracker.update(0.77);
  expect(tracker.update(0.81)).toEqual([80]);
  expect(tracker.update(1.01)).toEqual([95, 100]);
});
