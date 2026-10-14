import type { LabImage } from "./backgroundModel";

const SRGB_TO_LINEAR = Float32Array.from({ length: 256 }, (_, value) => {
  const normalized = value / 255;
  return normalized > 0.04045 ? ((normalized + 0.055) / 1.055) ** 2.4 : normalized / 12.92;
});

let canvas: OffscreenCanvas | null = null;
let context: OffscreenCanvasRenderingContext2D | null = null;

/** Reads a bitmap's pixels and converts them to CIE L*a*b* (D65), reusing one canvas across frames. */
export function bitmapToLab(bitmap: ImageBitmap): LabImage {
  const { width, height } = bitmap;
  if (!canvas || !context || canvas.width !== width || canvas.height !== height) {
    canvas = new OffscreenCanvas(width, height);
    context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("OffscreenCanvas 2D context unavailable");
  }
  context.drawImage(bitmap, 0, 0);
  return rgbaToLab(context.getImageData(0, 0, width, height).data, width, height);
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
