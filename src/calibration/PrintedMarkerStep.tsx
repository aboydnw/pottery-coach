import { useState } from "react";

import { parseDiameterMm } from "./wheelSize";

type Props = {
  initialDiameterMm: number | null;
  busy: boolean;
  onDiameter(diameterMm: number): void;
  onCalibrate(): void;
  onUseWheelHead(): void;
  onSkip(): void;
};

export function PrintedMarkerStep({
  initialDiameterMm,
  busy,
  onDiameter,
  onCalibrate,
  onUseWheelHead,
  onSkip,
}: Props) {
  const [diameterIn, setDiameterIn] = useState(
    initialDiameterMm === null ? "14" : String(Number((initialDiameterMm / 25.4).toFixed(1))),
  );
  const [rulerConfirmed, setRulerConfirmed] = useState(false);
  const diameterMm = parseDiameterMm(diameterIn, "in");

  function calibrate(): void {
    if (diameterMm === null || !rulerConfirmed) return;
    onDiameter(Number(diameterMm.toFixed(2)));
    onCalibrate();
  }

  return (
    <section className="printed-marker-step" aria-labelledby="printed-marker-title">
      <h3 id="printed-marker-title">Calibrate with the printed page</h3>
      <ol>
        <li>
          <a href="/calibration/board-v1.svg" target="_blank" rel="noreferrer">
            Open printable page
          </a>{" "}
          and print it at 100% scale. Do not use “fit to page.”
        </li>
        <li>Check the 100 mm line with a ruler.</li>
        <li>Place it flat on the wheel head and align its center target with the wheel axle.</li>
        <li>Keep the complete page visible, then do not move the phone after calibration.</li>
      </ol>
      <label>
        Wheel-head diameter in inches
        <input
          inputMode="decimal"
          value={diameterIn}
          aria-invalid={diameterMm === null}
          onChange={(event) => setDiameterIn(event.target.value)}
        />
      </label>
      {diameterMm === null && <p role="alert">Enter a wheel size between 8 and 19.5 inches.</p>}
      <label>
        <input
          type="checkbox"
          checked={rulerConfirmed}
          onChange={(event) => setRulerConfirmed(event.target.checked)}
        />
        The printed line measures exactly 100 mm
      </label>
      <button type="button" disabled={busy || !rulerConfirmed || diameterMm === null} onClick={calibrate}>
        {busy ? "Holding still…" : "Detect printed page"}
      </button>
      <button type="button" className="link-button" onClick={onUseWheelHead}>
        Use optional wheel-head detection instead
      </button>
      <button type="button" className="secondary" onClick={onSkip}>
        Skip sizes (shape only)
      </button>
    </section>
  );
}
