import { expect, it } from "vitest";
import { REALTIME_TOOL_DEFINITIONS } from "./definitions";

it("publishes exactly the allow-listed coaching tools to the provider", () => {
  expect(REALTIME_TOOL_DEFINITIONS.map((tool) => tool.name).sort()).toEqual([
    "compareTargetProfile", "getCurrentDimensions", "getMeasurementConfidence", "getWobbleStatus",
    "markMoment", "pauseCoaching", "resumeCoaching", "setGoal",
  ]);
});
