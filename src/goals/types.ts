export type ThrowingGoal = {
  id: string;
  targetId: string;
  basis: "wet" | "fired";
  desiredHeightMm: number;
  desiredMaximumWidthMm: number | null;
  shrinkageFraction: number | null;
};

export type GoalConfirmation = {
  goal: ThrowingGoal;
  wetHeightMm: number;
  wetMaximumWidthMm: number | null;
  equation: string;
};
