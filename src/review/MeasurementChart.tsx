import type { RecordedReading } from "../session/types";

export function MeasurementChart({ readings }: { readings: RecordedReading[] }) {
  const reliable = readings.filter((reading) => reading.confidence >= 0.7 && reading.values.heightMm != null);
  const max = Math.max(1, ...reliable.map((reading) => reading.values.heightMm ?? 0));
  const lastTime = Math.max(1, ...readings.map((reading) => reading.timestampMs));
  const groups = readings.reduce<RecordedReading[][]>((all, reading) => {
    if (reading.confidence < 0.7 || reading.values.heightMm == null) {
      if (all.at(-1)?.length) all.push([]);
    } else all.at(-1)!.push(reading);
    return all;
  }, [[]]).filter((group) => group.length);
  return <section aria-labelledby="measurements-title">
    <h2 id="measurements-title">Measurements</h2>
    <svg viewBox="0 0 300 110" role="img" aria-label="Reliable height measurements; gaps are not connected">
      {groups.map((group, groupIndex) => <path key={groupIndex}
        d={group.map((reading, index) => `${index ? "L" : "M"} ${(reading.timestampMs / lastTime) * 300} ${100 - ((reading.values.heightMm ?? 0) / max) * 90}`).join(" ")}
        fill="none" stroke="currentColor" strokeWidth="3" />)}
    </svg>
    <table aria-label="Measurement data"><thead><tr><th>Time</th><th>Height</th><th>Status</th></tr></thead>
      <tbody>{readings.map((reading) => { const measurable = reading.confidence >= 0.7 && reading.values.heightMm != null; return <tr key={reading.id}><td>{(reading.timestampMs / 1000).toFixed(1)}s</td>
        <td>{measurable ? `${reading.values.heightMm} mm` : "—"}</td>
        <td>{measurable ? "Measured" : "Not measured reliably"}</td></tr>; })}</tbody></table>
  </section>;
}
