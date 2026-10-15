import { proportionsOf } from "../measurement/scale";
import type { StableDimensionReading } from "../measurement/types";
import type { GoalConfirmation } from "../goals/types";

type Props = {
  /** Latest stable reading in pixels (shape only) or millimetres (sized). */
  reading: StableDimensionReading | null;
  sized: StableDimensionReading | null;
  goal: GoalConfirmation | null;
};

/** Large numbers readable from the wheel: sizes once calibrated, proportions before. */
export function LiveReadouts({ reading, sized, goal }: Props) {
  if (!reading) {
    return (
      <section className="readouts" aria-label="Live measurements">
        <p className="readout-waiting">Looking for the pot…</p>
      </section>
    );
  }
  if (!sized) {
    const { heightToWidth } = proportionsOf(reading);
    return (
      <section className="readouts" aria-label="Live measurements">
        <Readout label="Height ÷ width" value={heightToWidth === null ? "—" : heightToWidth.toFixed(2)} />
        <p className="readout-note">Shape only. Tell the coach your wheel size for centimetres.</p>
      </section>
    );
  }
  const progress = goal && sized.height !== null ? Math.round((sized.height / goal.wetHeightMm) * 100) : null;
  return (
    <section className="readouts" aria-label="Live measurements">
      <Readout label="Height" value={formatCm(sized.height)} />
      <Readout label="Widest" value={formatCm(sized.maximumWidth)} />
      {progress !== null && <Readout label="Of goal" value={`${progress}%`} />}
    </section>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="readout">
      <span className="readout-value">{value}</span>
      <span className="readout-label">{label}</span>
    </div>
  );
}

function formatCm(millimetres: number | null): string {
  return millimetres === null ? "—" : `${(millimetres / 10).toFixed(1)} cm`;
}
