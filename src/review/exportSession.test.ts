import { expect, it } from "vitest";
import { exportCsvReadings, exportJson } from "./exportSession";
import type { SessionBundle } from "../session/types";

const bundle = { session: { id: "=danger", schemaVersion: 1 }, readings: [
  { id: "+r", sessionId: "=danger", timestampMs: 1, kind: "stable", values: { heightMm: 12 }, confidence: 0.9 },
], diagnostics: [], events: [], moments: [], transcripts: [] } as unknown as SessionBundle;

it("exports stable versioned JSON", () => {
  expect(exportJson(bundle)).toContain('"exportSchemaVersion": 1');
});

it("neutralizes spreadsheet formulas in CSV cells", () => {
  const csv = exportCsvReadings(bundle);
  expect(csv).toContain("'=danger");
  expect(csv).toContain("'+r");
});
