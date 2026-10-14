import type { WobbleReading } from "./types";

export function StabilityStatus({ reading }: { reading: WobbleReading }) {
  return (
    <section aria-label="Visible stability status">
      <h2>Visible stability</h2>
      <p>
        {reading.classification.replaceAll("-", " ")} · confidence {Math.round(reading.confidence * 100)}%
      </p>
      <p>This describes visible motion only and does not infer clay pressure, thickness, moisture, or cause.</p>
    </section>
  );
}
