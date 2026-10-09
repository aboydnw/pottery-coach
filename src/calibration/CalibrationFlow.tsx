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
        <button type="button" onClick={onRecalibrate}>Recalibrate</button>
      </section>
    );
  }

  return (
    <section aria-labelledby="calibration-title">
      <h2 id="calibration-title">Confirm calibration</h2>
      <p>Keep the printed board within 30 mm of the vessel plane and fully visible.</p>
      <label>
        <input type="checkbox" checked={scaleConfirmed} onChange={(event) => setScaleConfirmed(event.target.checked)} />
        The printed 100 mm line measures exactly 100 mm
      </label>

      {result.status === "manual-review" && (
        <fieldset>
          <legend>Manual geometry review</legend>
          <label>
            <input required type="checkbox" checked={baselineConfirmed} onChange={(event) => setBaselineConfirmed(event.target.checked)} />
            Wheel baseline matches the overlay
          </label>
          <label>
            <input required type="checkbox" checked={axisConfirmed} onChange={(event) => setAxisConfirmed(event.target.checked)} />
            Vertical axis matches the overlay
          </label>
        </fieldset>
      )}

      {result.reasons.length > 0 && (
        <ul aria-label="Calibration problems">
          {result.reasons.map((reason) => <li key={reason}>{reasonLabel(reason)}</li>)}
        </ul>
      )}

      {!hardFailure && (
        <button
          type="button"
          disabled={!scaleConfirmed || (result.status === "manual-review" && (!baselineConfirmed || !axisConfirmed))}
          onClick={() => onAccepted({
            ...result,
            status: "accepted",
            provenance: result.status === "manual-review" ? "manual-assisted" : result.provenance,
          })}
        >
          Use calibration
        </button>
      )}
    </section>
  );
}

function reasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    ROI_CLIPPED: "ROI clipped — move the camera until the full working area is visible.",
    BOARD_REVISION: "Unsupported calibration board revision.",
    ESTIMATED_ERROR: "Estimated measurement error is too high.",
    SCALE_VARIATION: "Print scale or perspective variation is too high.",
    REPROJECTION_ERROR: "The board could not be aligned reliably.",
  };
  return labels[reason] ?? reason.replaceAll("_", " ").toLowerCase();
}
