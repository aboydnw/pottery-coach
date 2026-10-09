import type { GoalConfirmation, ThrowingGoal } from "./types";

const BOUNDS = { height: { min: 50, max: 500 }, width: { min: 20, max: 400 } };

export function toWetGoal(goal: ThrowingGoal): GoalConfirmation {
  if (goal.desiredHeightMm < BOUNDS.height.min || goal.desiredHeightMm > BOUNDS.height.max) {
    throw new RangeError(`Height must be between ${BOUNDS.height.min} and ${BOUNDS.height.max} mm`);
  }
  if (goal.desiredMaximumWidthMm !== null &&
    (goal.desiredMaximumWidthMm < BOUNDS.width.min || goal.desiredMaximumWidthMm > BOUNDS.width.max)) {
    throw new RangeError(`Width must be between ${BOUNDS.width.min} and ${BOUNDS.width.max} mm`);
  }
  if (goal.basis === "wet") {
    return { goal, wetHeightMm: goal.desiredHeightMm, wetMaximumWidthMm: goal.desiredMaximumWidthMm, equation: "Wet goal uses the entered dimensions unchanged." };
  }
  if (goal.shrinkageFraction === null) throw new Error("Fired goals require an explicit shrinkage fraction");
  if (goal.shrinkageFraction < 0 || goal.shrinkageFraction > 0.25) throw new RangeError("Shrinkage must be between 0 and 0.25");
  const divisor = 1 - goal.shrinkageFraction;
  return {
    goal,
    wetHeightMm: goal.desiredHeightMm / divisor,
    wetMaximumWidthMm: goal.desiredMaximumWidthMm === null ? null : goal.desiredMaximumWidthMm / divisor,
    equation: `${goal.desiredHeightMm} ÷ (1 − ${goal.shrinkageFraction}) = ${(goal.desiredHeightMm / divisor).toFixed(2)} mm wet`,
  };
}
