import type { GoalConfirmation, ThrowingGoal } from "../../goals/types";
import type { DimensionReading } from "../../measurement/types";
import type { ProfileComparison } from "../../targets/types";
import type { WobbleReading } from "../../wobble/types";

export type MarkedMoment = { id: string; timestampMs: number };
export type ToolDependencies = {
  now(): number;
  getDimensions(): DimensionReading | null;
  getWobble(): WobbleReading | null;
  getComparison(): ProfileComparison | null;
  setGoal(goal: ThrowingGoal): Promise<GoalConfirmation>;
  setPaused(paused: boolean): void;
  markMoment(input: { label?: string }): Promise<MarkedMoment>;
};
