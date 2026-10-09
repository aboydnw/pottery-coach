import { useState } from "react";

import { toWetGoal } from "./sizeGoal";
import type { GoalConfirmation, ThrowingGoal } from "./types";

export function GoalForm({ targetId, onConfirm }: { targetId: string; onConfirm(value: GoalConfirmation): void }) {
  const [basis, setBasis] = useState<ThrowingGoal["basis"]>("wet");
  const [height, setHeight] = useState(300);
  const [width, setWidth] = useState<string>("");
  const [shrinkagePercent, setShrinkagePercent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<GoalConfirmation | null>(null);

  function buildGoal(): ThrowingGoal {
    return {
      id: globalThis.crypto?.randomUUID?.() ?? `goal-${Date.now()}`,
      targetId,
      basis,
      desiredHeightMm: height,
      desiredMaximumWidthMm: width === "" ? null : Number(width),
      shrinkageFraction: shrinkagePercent === "" ? null : Number(shrinkagePercent) / 100,
    };
  }

  function reviewGoal(): void {
    setError(null);
    try { setReview(toWetGoal(buildGoal())); }
    catch (caught) { setReview(null); setError(caught instanceof Error ? caught.message : "Goal is invalid"); }
  }

  return (
    <section aria-labelledby="goal-title">
      <h2 id="goal-title">Set throwing goal</h2>
      <label>Basis
        <select aria-label="Goal basis" value={basis} onChange={(event) => { setBasis(event.target.value as ThrowingGoal["basis"]); setReview(null); }}>
          <option value="wet">Wet dimensions</option><option value="fired">Fired dimensions</option>
        </select>
      </label>
      <label>Desired height (mm)<input aria-label="Desired height" type="number" value={height} onChange={(event) => setHeight(Number(event.target.value))} /></label>
      <label>Maximum width (mm, optional)<input aria-label="Maximum width" type="number" value={width} onChange={(event) => setWidth(event.target.value)} /></label>
      {basis === "fired" && <label>Shrinkage percent<input aria-label="Shrinkage percent" type="number" min="0" max="25" value={shrinkagePercent} onChange={(event) => setShrinkagePercent(event.target.value)} /></label>}
      {error && <p role="alert">{error}</p>}
      <button type="button" onClick={reviewGoal}>Review goal</button>
      {review && <div className="goal-review"><p>{review.equation}</p><p>No universal clay shrinkage is assumed. Confirm this value for your clay and firing schedule.</p><button type="button" onClick={() => onConfirm(review)}>Confirm goal</button></div>}
    </section>
  );
}
