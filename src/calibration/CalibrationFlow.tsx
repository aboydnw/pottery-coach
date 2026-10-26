import { useState } from "react";

import type { CalibrationResult } from "./types";

type Props = {
  result: CalibrationResult;
  boardMoved?: boolean;
  onAccepted(result: CalibrationResult): void;
  onRecalibrate?(): void;
};

const HARD_FAILURES = new Set([
  "ROI_CLIPPED",
  "BOARD_REVISION",
  "ESTIMATED_ERROR",
  "SCALE_VARIATION",
  "DIAMETER_MISMATCH",
  "DIAMETER_IMPLAUSIBLE",
]);

export function CalibrationFlow({ result, boardMoved = false, onAccepted, onRecalibrate }: Props) {
  const [scaleConfirmed, setScaleConfirmed] = useState(false);
  const [baselineConfirmed, setBaselineConfirmed] = useState(false);
  const [axisConfirmed, setAxisConfirmed] = useState(false);
  const hardFailure = result.status === "rejected" || result.reasons.some((reason) => HARD_FAILURES.has(reason));

  if (boardMoved) {
    return (
      <section aria-labelledby="calibration-title">
        <h2 id="calibration-title">Calibration</h2>
        <p role="status">The board moved. Measurements are stale until you recalibrate.</p>
        <button type="button" onClick={onRecalibrate}>
          Recalibrate
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="calibration-title">
      <h2 id="calibration-title">Confirm calibration</h2>
      <p>Keep the printed page flat, centered on the wheel axle, and fully visible.</p>
      <label>
        <input type="checkbox" checked={scaleConfirmed} onChange={(event) => setScaleConfirmed(event.target.checked)} />
        The printed 100 mm line measures exactly 100 mm
      </label>

      {result.status === "manual-review" && (
        <fieldset>
          <legend>Manual geometry review</legend>
          <label>
            <input
              required
              type="checkbox"
              checked={baselineConfirmed}
              onChange={(event) => setBaselineConfirmed(event.target.checked)}
            />
            Wheel baseline matches the overlay
          </label>
          <label>
            <input
              required
              type="checkbox"
              checked={axisConfirmed}
              onChange={(event) => setAxisConfirmed(event.target.checked)}
            />
            Vertical axis matches the overlay
          </label>
        </fieldset>
      )}

      {result.reasons.length > 0 && (
        <ul aria-label="Calibration problems">
          {result.reasons.map((reason) => (
            <li key={reason}>{describeCalibrationReason(reason)}</li>
          ))}
        </ul>
      )}

      {!hardFailure && (
        <button
          type="button"
          disabled={!scaleConfirmed || (result.status === "manual-review" && (!baselineConfirmed || !axisConfirmed))}
          onClick={() =>
            onAccepted({
              ...result,
              status: "accepted",
              provenance: result.status === "manual-review" ? "manual-assisted" : result.provenance,
            })
          }
        >
          Use calibration
        </button>
      )}
    </section>
  );
}

/** Plain-language explanation of a calibration reason code. */
export function describeCalibrationReason(reason: string): string {
  const labels: Record<string, string> = {
    WHEEL_TOO_SMALL: "The wheel head is too small in the view. Move the phone closer so it spans more of the picture.",
    WHEEL_IMPLAUSIBLE:
      "Those markers can't be the wheel-head edges. Put the left marker on the left edge and the right marker on the right edge.",
    TAG_COUNT: "Fewer than three board tags were found. Keep all four corner tags in view.",
    ROI_CLIPPED: "ROI clipped — move the camera until the full working area is visible.",
    BOARD_REVISION: "Unsupported calibration board revision.",
    ESTIMATED_ERROR: "Estimated measurement error is too high.",
    SCALE_VARIATION: "Print scale or perspective variation is too high.",
    REPROJECTION_ERROR: "The board could not be aligned reliably.",
    WHEEL_RIM_INCOMPLETE: "Move the phone until the whole wheel rim is visible.",
    WORKING_REGION_CLIPPED: "Tilt or move the phone so there is more room above the wheel.",
    VIEW_TOO_SHALLOW: "Raise the phone so more of the wheel's top is visible.",
    VIEW_TOO_STEEP: "Lower or move the phone back so the pot's side remains visible.",
    VIEW_OFF_AXIS: "Aim the phone more directly through the center of the wheel.",
    ELLIPSE_UNSTABLE: "Hold the phone still while the wheel outline locks.",
    ELLIPSE_AMBIGUOUS: "Choose the outline that matches your wheel head or bat.",
    DIAMETER_MISMATCH: "The entered wheel diameter does not match the optional rim check. Recheck the size and page centering.",
    DIAMETER_IMPLAUSIBLE: "Enter a wheel-head diameter between 15 and 50 cm.",
  };
  return labels[reason] ?? reason.replaceAll("_", " ").toLowerCase();
}
