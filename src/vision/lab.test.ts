import { afterEach, expect, it, vi } from "vitest";
import { bitmapToPixels, rgbaToLab } from "./lab";

afterEach(() => vi.unstubAllGlobals());

it("maps white, black, and pure red to their reference L*a*b* values", () => {
  const { lab } = rgbaToLab(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 255]), 3, 1);
  expect(lab[0]).toBeCloseTo(100, 0);
  expect(Math.abs(lab[1]!)).toBeLessThan(0.5);
  expect(lab[3]).toBeCloseTo(0, 0);
  expect(lab[6]).toBeCloseTo(53.2, 0);
  expect(lab[7]).toBeCloseTo(80.1, 0);
  expect(lab[8]).toBeCloseTo(67.2, 0);
});

it("returns RGBA and LAB values from one canvas read", () => {
  const rgba = new Uint8ClampedArray([255, 0, 0, 255]);
  const getImageData = vi.fn(() => ({ data: rgba }));
  const drawImage = vi.fn();
  vi.stubGlobal(
    "OffscreenCanvas",
    class {
      width: number;
      height: number;
      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
      }
      getContext() {
        return { drawImage, getImageData };
      }
    },
  );

  const pixels = bitmapToPixels({ width: 1, height: 1 } as ImageBitmap);

  expect(drawImage).toHaveBeenCalledOnce();
  expect(getImageData).toHaveBeenCalledOnce();
  expect(pixels.rgba).toEqual(rgba);
  expect(pixels.lab.lab[0]).toBeCloseTo(53.2, 0);
});
