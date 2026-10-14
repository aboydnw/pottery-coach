import { expect, it } from "vitest";
import { rgbaToLab } from "./lab";

it("maps white, black, and pure red to their reference L*a*b* values", () => {
  const { lab } = rgbaToLab(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 255]), 3, 1);
  expect(lab[0]).toBeCloseTo(100, 0);
  expect(Math.abs(lab[1]!)).toBeLessThan(0.5);
  expect(lab[3]).toBeCloseTo(0, 0);
  expect(lab[6]).toBeCloseTo(53.2, 0);
  expect(lab[7]).toBeCloseTo(80.1, 0);
  expect(lab[8]).toBeCloseTo(67.2, 0);
});
