import type { RecordedReading } from "../session/types";

export function MeasurementChart({ readings }: { readings: RecordedReading[] }) {
  const reliable = readings.filter((reading) => reading.confidence >= 0.7 && reading.values.heightMm != null);
  const max = Math.max(1, ...reliable.map((reading) => reading.values.heightMm ?? 0));
  const lastTime = Math.max(1, ...readings.map((reading) => reading.timestampMs));
  const path = reliable.map((reading, index) => `${index ? "L" : "M"} ${(reading.timestampMs / lastTime) * 300} ${100 - ((reading.values.heightMm ?? 0) / max) * 90}`).join(" ");
  return <section aria-labelledby="measurements-title">
    <h2 id="measurements-title">Measurements</h2>
    <svg viewBox="0 0 300 110" role="img" aria-label="Reliable height measurements; gaps are not connected">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="3" />
    </svg>
    <table aria-label="Measurement data"><thead><tr><th>Time</th><th>Height</th><th>Status</th></tr></thead>
      <tbody>{readings.map((reading) => <tr key={reading.id}><td>{(reading.timestampMs / 1000).toFixed(1)}s</td>
        <td>{reading.confidence >= 0.7 ? `${reading.values.heightMm ?? "—"} mm` : "—"}</td>
        <td>{reading.confidence >= 0.7 ? "Measured" : "Not measured reliably"}</td></tr>)}</tbody></table>
  </section>;
}
