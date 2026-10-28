import { expect, it } from "vitest";

import { createDatasetExample } from "./example";
import { exportDataset } from "./export";

it("exports versioned reviewed examples without identity, voice, or precise timestamp fields", async () => {
  const example = createDatasetExample({
    sessionGroupId: "session-a",
    frameDataUrl: "data:image/webp;base64,AAAA",
    width: 1,
    height: 1,
    automaticMask: new Uint8Array([0]),
    correctedMask: null,
    verdict: "no-clay",
    calibrationId: "cal-1",
    wheelDiameterMm: 355.6,
    calibrationGeometry: null,
    segmentationVersion: "background-v1",
    conditions: ["empty-wheel"],
    rights: "tester-owned",
  });
  const text = await exportDataset([example]).text();
  expect(text).toContain('"schemaVersion":"clay-dataset-v1"');
  expect(text).not.toMatch(/email|transcript|createdAtMs/);
});
