import { useState } from "react";
import { formatDiameter, inchesToMm, parseDiameterMm, WHEEL_PRESETS_IN, type LengthUnit } from "./wheelSize";

type Props = {
  initialDiameterMm: number | null;
  busy: boolean;
  onFind(diameterMm: number): void;
};

/** Asks for the wheel-head (or bat) diameter, then starts edge detection. */
export function WheelHeadStep({ initialDiameterMm, busy, onFind }: Props) {
  const initialPreset = WHEEL_PRESETS_IN.find(
    (inches) => initialDiameterMm !== null && Math.abs(inchesToMm(inches) - initialDiameterMm) < 0.5,
  );
  const [preset, setPreset] = useState<number | "other" | null>(
    initialPreset ?? (initialDiameterMm === null ? null : "other"),
  );
  const [custom, setCustom] = useState(
    initialDiameterMm !== null && initialPreset === undefined
      ? String(Number((initialDiameterMm / 25.4).toFixed(1)))
      : "",
  );
  const [unit, setUnit] = useState<LengthUnit>("in");
  const diameterMm = preset === null ? null : preset === "other" ? parseDiameterMm(custom, unit) : inchesToMm(preset);
  const customInvalid = preset === "other" && custom.trim() !== "" && diameterMm === null;

  return (
    <div className="wheel-head-step">
      <fieldset>
        <legend>How wide is the wheel head or bat your pot sits on?</legend>
        <div className="choice-row">
          {WHEEL_PRESETS_IN.map((inches) => (
            <button
              key={inches}
              type="button"
              className="chip"
              aria-pressed={preset === inches}
              onClick={() => setPreset(inches)}
            >
              {inches} in
            </button>
          ))}
          <button type="button" className="chip" aria-pressed={preset === "other"} onClick={() => setPreset("other")}>
            Other size
          </button>
        </div>
        {preset === "other" && (
          <div className="choice-row">
            <label>
              Diameter
              <input
                inputMode="decimal"
                value={custom}
                onChange={(event) => setCustom(event.target.value)}
                aria-invalid={customInvalid}
              />
            </label>
            <label>
              Unit
              <select value={unit} onChange={(event) => setUnit(event.target.value as LengthUnit)}>
                <option value="in">inches</option>
                <option value="cm">centimetres</option>
              </select>
            </label>
          </div>
        )}
        {customInvalid && <p role="alert">Enter a size between 20 and 50 cm (8 and 19.5 in).</p>}
      </fieldset>
      <p>
        Measure across the top of the wheel head, or the bat if you throw on one. Most wheels are 12–14 in. We remember
        this size, but check the camera view each time.
      </p>
      <button
        type="button"
        disabled={busy || diameterMm === null}
        onClick={() => diameterMm !== null && onFind(diameterMm)}
      >
        {busy
          ? "Looking for the wheel head…"
          : diameterMm === null
            ? "Find wheel head"
            : `Find ${formatDiameter(diameterMm, unit)} wheel head`}
      </button>
    </div>
  );
}
