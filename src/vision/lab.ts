import type { LabImage } from "./backgroundModel";

const SRGB_TO_LINEAR = Float32Array.from({ length: 256 }, (_, value) => {
  const normalized = value / 255;
  return normalized > 0.04045 ? ((normalized + 0.055) / 1.055) ** 2.4 : normalized / 12.92;
});

let canvas: OffscreenCanvas | null = null;
let context: OffscreenCanvasRenderingContext2D | null = null;

export type BitmapPixels = { width: number; height: number; rgba: Uint8ClampedArray; lab: LabImage };

/** Reads a bitmap once and returns both its original RGBA pixels and CIE L*a*b* conversion. */
export function bitmapToPixels(bitmap: ImageBitmap): BitmapPixels {
  const { width, height } = bitmap;
  if (!canvas || !context || canvas.width !== width || canvas.height !== height) {
    canvas = new OffscreenCanvas(width, height);
    context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("OffscreenCanvas 2D context unavailable");
  }
  context.drawImage(bitmap, 0, 0);
  const rgba = context.getImageData(0, 0, width, height).data;
  return { width, height, rgba, lab: rgbaToLab(rgba, width, height) };
}

/** Compatibility wrapper for callers that do not need exportable source pixels. */
export function bitmapToLab(bitmap: ImageBitmap): LabImage {
  return bitmapToPixels(bitmap).lab;
}

/** Converts packed 8-bit RGBA pixels to a packed L*a*b* float array. */
export function rgbaToLab(rgba: Uint8ClampedArray, width: number, height: number): LabImage {
  const lab = new Float32Array(width * height * 3);
  for (let pixel = 0, source = 0, target = 0; pixel < width * height; pixel += 1, source += 4, target += 3) {
    const red = SRGB_TO_LINEAR[rgba[source]!]!;
    const green = SRGB_TO_LINEAR[rgba[source + 1]!]!;
    const blue = SRGB_TO_LINEAR[rgba[source + 2]!]!;
    const fx = labCurve((red * 0.4124 + green * 0.3576 + blue * 0.1805) / 0.95047);
    const fy = labCurve(red * 0.2126 + green * 0.7152 + blue * 0.0722);
    const fz = labCurve((red * 0.0193 + green * 0.1192 + blue * 0.9505) / 1.08883);
    lab[target] = 116 * fy - 16;
    lab[target + 1] = 500 * (fx - fy);
    lab[target + 2] = 200 * (fy - fz);
  }
  return { width, height, lab };
}

function labCurve(value: number): number {
  return value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
}
