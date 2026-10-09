import { expect, it } from "vitest";

import { buildBackground } from "./backgroundModel";

it("uses robust channel medians so a transient clay pixel does not become background", () => {
  const frames = [10, 10, 90, 10, 10].map((lightness) => ({
    width: 1, height: 1, lab: new Float32Array([lightness, 2, 3]),
  }));
  const model = buildBackground(frames);
  expect([...model.medianLab]).toEqual([10, 2, 3]);
  expect(model.distanceThreshold).toBeGreaterThan(0);
});
