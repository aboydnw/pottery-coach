import { expect, it } from "vitest";

import type { BackgroundModel, LabImage } from "./backgroundModel";
import { BackgroundClaySegmenter } from "./BackgroundClaySegmenter";

it("emits a versioned probability mask through the common provider contract", async () => {
  const background: BackgroundModel = {
    width: 2,
    height: 2,
    medianLab: new Float32Array(12),
    distanceThreshold: 5,
  };
  const image: LabImage = {
    width: 2,
    height: 2,
    lab: new Float32Array([0, 0, 0, 10, 0, 0, 10, 0, 0, 0, 0, 0]),
  };
  const output = await new BackgroundClaySegmenter(background).segment({ width: 2, height: 2, lab: image });
  expect(output.modelVersion).toBe("background-v1");
  expect([...output.probability]).toEqual([0, 1, 1, 0]);
});

it("refuses a frame that does not match the learned background", async () => {
  const background: BackgroundModel = {
    width: 2,
    height: 2,
    medianLab: new Float32Array(12),
    distanceThreshold: 5,
  };
  await expect(
    new BackgroundClaySegmenter(background).segment({
      width: 1,
      height: 1,
      lab: { width: 1, height: 1, lab: new Float32Array(3) },
    }),
  ).rejects.toThrow(/dimensions/i);
});
