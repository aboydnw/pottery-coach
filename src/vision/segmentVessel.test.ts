import { expect, it } from "vitest";

import { segmentVessel } from "./segmentVessel";

it("selects the clay component connected to the wheel band and excludes a detached hand", () => {
  const width = 10;
  const height = 10;
  const lab = new Float32Array(width * height * 3);
  for (let pixel = 0; pixel < width * height; pixel += 1) lab.set([10, 0, 0], pixel * 3);
  for (let y = 3; y <= 9; y += 1) for (let x = 4; x <= 6; x += 1) lab[y * width * 3 + x * 3] = 70;
  lab[1 * width * 3 + 1 * 3] = 70;

  const result = segmentVessel(
    { width, height, lab },
    { width, height, medianLab: new Float32Array(Array(width * height).fill([10, 0, 0]).flat()), distanceThreshold: 15 },
    [],
  );

  expect(result.mask[1 * width + 1]).toBe(0);
  expect(result.mask[8 * width + 5]).toBe(1);
  expect(result.reasons).not.toContain("NO_WHEEL_CONNECTED_COMPONENT");
});
