import { GoalForm } from "../goals/GoalForm";
import type { GoalConfirmation } from "../goals/types";
import type { TargetProfile } from "./types";

export function TargetSetup({
  templates,
  targetId,
  onTargetChange,
  onGoalConfirmed,
}: {
  templates: TargetProfile[];
  targetId: string;
  onTargetChange(targetId: string): void;
  onGoalConfirmed(goal: GoalConfirmation): void;
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
      <GoalForm targetId={targetId} onConfirm={onGoalConfirmed} />
    </section>
  );
}
