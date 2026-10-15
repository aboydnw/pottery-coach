import { useState, type ReactNode } from "react";
import { GoalForm } from "../goals/GoalForm";
import type { GoalConfirmation } from "../goals/types";
import { setupStatus, TARGET_NAMES, type SetupSlots } from "../setup/setupSlots";
import type { TargetProfile } from "../targets/types";

type Props = {
  slots: SetupSlots;
  templates: TargetProfile[];
  /** Open by default when there is no voice coach to do setup by conversation. */
  defaultOpen: boolean;
  calibration: ReactNode;
  onTargetChange(targetId: string): void;
  onGoal(goal: GoalConfirmation): void;
};

/**
 * The setup slots at a glance, with on-screen editing as a fallback for when voice isn't available.
 * Every edit goes into the same slots the voice coach fills.
 */
export function SetupChecklist({ slots, templates, defaultOpen, calibration, onTargetChange, onGoal }: Props) {
  const [editingGoal, setEditingGoal] = useState(false);
  const status = setupStatus(slots);
  const goal = slots.goal?.confirmed ? slots.goal.value : null;
  return (
    <details className="setup-checklist" open={defaultOpen}>
      <summary>Setup: {status.summary}</summary>
      <ul className="slot-list">
        <li>
          <strong>Wheel head:</strong>{" "}
          {slots.wheelHeadDiameterMm?.confirmed
            ? `${(slots.wheelHeadDiameterMm.value / 25.4).toFixed(1)} in`
            : slots.calibration === "skipped"
              ? "skipped (shape only)"
              : "not set"}
          {slots.calibration === "confirmed" && " · edges checked"}
        </li>
        <li>
          <strong>Target:</strong> {TARGET_NAMES[slots.targetId.value]}
        </li>
        <li>
          <strong>Goal:</strong> {goal ? `${(goal.heightMm / 10).toFixed(1)} cm ${goal.basis}` : "not set"}
        </li>
      </ul>
      {calibration}
      <label>
        Target shape
        <select value={slots.targetId.value} onChange={(event) => onTargetChange(event.target.value)}>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </label>
      {goal && !editingGoal ? (
        <button type="button" className="secondary" onClick={() => setEditingGoal(true)}>
          Change goal
        </button>
      ) : (
        <GoalForm
          targetId={slots.targetId.value}
          onConfirm={(value) => {
            setEditingGoal(false);
            onGoal(value);
          }}
        />
      )}
    </details>
  );
}
