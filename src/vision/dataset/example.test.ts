import { expect, it } from "vitest";

import { createDatasetExample, decodeMask } from "./example";

const input = {
  sessionGroupId: "session-a",
  frameDataUrl: "data:image/webp;base64,AAAA",
  width: 2,
  height: 2,
  automaticMask: new Uint8Array([0, 1, 1, 0]),
  correctedMask: new Uint8Array([0, 1, 0, 0]),
  verdict: "corrected" as const,
  calibrationId: "cal-1",
  wheelDiameterMm: 355.6,
  segmentationVersion: "background-v1",
  conditions: ["wet-clay"] as const,
  rights: "tester-owned" as const,
};

it("requires an explicit review verdict", () => {
  expect(() => createDatasetExample({ ...input, verdict: undefined as never })).toThrow(/verdict/i);
});

it("round-trips compact binary masks", () => {
  const example = createDatasetExample(input);
  expect([...decodeMask(example.correctedMask!, 4)]).toEqual([0, 1, 0, 0]);
});

it("rejects mask dimensions that do not match the frame", () => {
  expect(() => createDatasetExample({ ...input, correctedMask: new Uint8Array(3) })).toThrow(/mask/i);
});
