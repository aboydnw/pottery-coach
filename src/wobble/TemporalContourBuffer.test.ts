import { expect, it } from "vitest";

import { TemporalContourBuffer } from "./TemporalContourBuffer";
import type { TemporalContourSample } from "./types";

function sample(timestampMs: number, frameId = timestampMs): TemporalContourSample {
  return { timestampMs, frameId, centersMm: [0, null, 1], leftMm: [-1, null, 0], rightMm: [1, null, 2], rimCenterMm: 0, rimHeightMm: 100, cameraTransformConfidence: 1, occluded: false, shapeChangeRate: 0 };
}

it("returns irregular samples chronologically and preserves null bands", () => {
  const buffer = new TemporalContourBuffer();
  [900, 100, 450].forEach((timestamp) => buffer.push(sample(timestamp)));
  const result = buffer.window(1000);
  expect(result.map((item) => item.timestampMs)).toEqual([100, 450, 900]);
  expect(result[0]?.centersMm[1]).toBeNull();
});

it("evicts evidence older than 120 seconds and caps at 2400 samples", () => {
  const buffer = new TemporalContourBuffer();
  for (let index = 0; index < 2500; index += 1) buffer.push(sample(index * 100, index));
  const result = buffer.window(1_000_000);
  expect(result.length).toBeLessThanOrEqual(1201);
  expect(result.at(-1)?.frameId).toBe(2499);
});

it("clears on calibration or visibility invalidation", () => {
  const buffer = new TemporalContourBuffer(); buffer.push(sample(1));
  buffer.clear("visibility-change");
  expect(buffer.window(1000)).toEqual([]);
});
