import type { SessionBundle } from "../session/types";

export function exportJson(bundle: SessionBundle) {
  return JSON.stringify({ exportSchemaVersion: 1, ...bundle }, null, 2);
}

function cell(value: unknown) {
  const source = String(value ?? "");
  const safe = /^[=+\-@]/.test(source) ? `'${source}` : source;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function exportCsvReadings(bundle: SessionBundle) {
  const rows = [["sessionId", "readingId", "timestampMs", "confidence", "heightMm", "maximumWidthMm"],
    ...bundle.readings.map((reading) => [bundle.session.id, reading.id, reading.timestampMs, reading.confidence,
      reading.values.heightMm ?? "", reading.values.maximumWidthMm ?? ""])];
  return rows.map((row) => row.map(cell).join(",")).join("\n");
}
