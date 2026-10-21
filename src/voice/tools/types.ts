import type { GoalConfirmation } from "../../goals/types";
import type { SessionScale } from "../../measurement/scale";
import type { StableDimensionReading } from "../../measurement/types";
import type { SetupStore } from "../../setup/SetupStore";
import type { TargetProfile } from "../../targets/types";
import type { WobbleReading } from "../../wobble/types";

export type MarkedMoment = { id: string; timestampMs: number };

export type WheelCheck = { found: boolean; confidence: number; problem?: string };
export type WheelConfirmation = { accepted: boolean; problems: string[] };

export type SpokenSummary = {
  durationMinutes: number;
  sizesAvailable: boolean;
  peakHeightMm: number | null;
  finalHeightMm: number | null;
  finalMaximumWidthMm: number | null;
  goalHeightMm: number | null;
  markedMoments: number;
};

/**
 * What the voice tools can see and do. The live session and the review screen each provide the
 * parts that exist at that moment; anything missing answers "not available right now".
 */
export type ToolDependencies = {
  now(): number;
  getReading(): StableDimensionReading | null;
  getScale(): SessionScale | null;
  getWobble(): WobbleReading | null;
  getTarget(): TargetProfile;
  getGoal(): GoalConfirmation | null;
  setup: SetupStore;
  wheel?: {
    check(fresh: boolean): Promise<WheelCheck>;
    adjust(side: "left" | "right", direction: "in" | "out", size: "small" | "large"): void;
    confirm(): WheelConfirmation;
    skip(): void;
  };
  setPaused(paused: boolean): void;
  markMoment?(input: { label?: string }): Promise<MarkedMoment>;
  endSession?(): Promise<void>;
  getSessionSummary?(): Promise<SpokenSummary | null>;
};
