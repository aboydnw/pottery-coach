import { GoalForm } from "../goals/GoalForm";
import type { GoalConfirmation } from "../goals/types";
import type { TargetProfile } from "./types";

export function TargetSetup({
  templates,
  targetId,
  onTargetChange,
  onGoalConfirmed,
  shapeOnly = false,
  started = false,
  onStartShapeOnly,
}: {
  templates: TargetProfile[];
  targetId: string;
  onTargetChange(targetId: string): void;
  onGoalConfirmed(goal: GoalConfirmation): void;
  /** Without calibration there is no size to aim for, so only the target shape is chosen. */
  shapeOnly?: boolean;
  /** The live session is running; the template can still change but there is nothing to start. */
  started?: boolean;
  onStartShapeOnly?(): void;
}) {
  return (
    <section className="target-setup" aria-labelledby="target-title">
      <h2 id="target-title">Choose a target</h2>
      <label>
        Template
        <select value={targetId} onChange={(event) => onTargetChange(event.target.value)}>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </label>
      {shapeOnly ? (
        !started && (
          <button type="button" onClick={onStartShapeOnly}>
            Start shape-only session
          </button>
        )
      ) : (
        <GoalForm targetId={targetId} onConfirm={onGoalConfirmed} />
      )}
    </section>
  );
}
