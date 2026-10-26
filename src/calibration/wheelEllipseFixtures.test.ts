import { describe, expect, it } from "vitest";
import { detectWheelEllipses } from "./wheelEllipse";

type SceneOptions = {
  width?: number;
  height?: number;
  centerX?: number;
  centerY?: number;
  radiusMajor?: number;
  radiusMinor?: number;
  rotationRad?: number;
  background?: number;
  rim?: number;
  missingSectors?: number[];
  clutter?: boolean;
};

function renderWheelScene(options: SceneOptions = {}) {
  const width = options.width ?? 320;
  const height = options.height ?? 240;
  const centerX = options.centerX ?? 164;
  const centerY = options.centerY ?? 174;
  const radiusMajor = options.radiusMajor ?? 104;
  const radiusMinor = options.radiusMinor ?? 43;
  const rotation = options.rotationRad ?? -0.08;
  const background = options.background ?? 118;
  const rim = options.rim ?? 205;
  const missing = new Set(options.missingSectors ?? []);
  const gray = new Float32Array(width * height).fill(background);
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);

  for (let sector = 0; sector < 72; sector += 1) {
    if (missing.has(sector)) continue;
    for (let step = 0; step < 6; step += 1) {
      const angle = ((sector + step / 6) / 72) * Math.PI * 2;
      for (let thickness = -1.5; thickness <= 1.5; thickness += 1) {
        const major = (radiusMajor + thickness) * Math.cos(angle);
        const minor = (radiusMinor + thickness) * Math.sin(angle);
        const x = Math.round(centerX + cosine * major - sine * minor);
        const y = Math.round(centerY + sine * major + cosine * minor);
        if (x >= 0 && x < width && y >= 0 && y < height) gray[y * width + x] = rim;
      }
    }
  }

  if (options.clutter) {
    // A face-like filled oval, apron stripe, and box edge should not beat a supported wheel rim.
    for (let y = 24; y < 116; y += 1) {
      for (let x = 35; x < 115; x += 1) {
        if (((x - 75) / 40) ** 2 + ((y - 70) / 46) ** 2 <= 1) gray[y * width + x] = 168;
      }
    }
    for (let y = 120; y < 220; y += 1) gray[y * width + 250] = 35;
    for (let x = 210; x < 300; x += 1) gray[145 * width + x] = 35;
  }

  return { gray, width, height };
}

describe("wheel-rim scenes", () => {
  it("finds the complete rim when a studio floor edge crosses behind its lower half", () => {
    const width = 320;
    const height = 180;
    const gray = new Float32Array(width * height).fill(190);
    for (let y = 150; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) gray[y * width + x] = 140;
    }
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (((x - 160) / 96) ** 2 + ((y - 140) / 30) ** 2 <= 1) gray[y * width + x] = 82;
      }
    }

    const [candidate] = detectWheelEllipses({ gray, width, height });

    expect(candidate).toBeDefined();
    expect(candidate!.centerX).toBeCloseTo(160, 0);
    expect(candidate!.centerY).toBeCloseTo(140, 0);
    expect(candidate!.radiusMajor).toBeCloseTo(96, 0);
  });

  it.each([
    { background: 70, rim: 190 },
    { background: 190, rim: 65 },
    { background: 112, rim: 142 },
  ])("recovers an outlined complete rim across contrast polarities", ({ background, rim }) => {
    const scene = renderWheelScene({ background, rim, clutter: true });
    const [candidate] = detectWheelEllipses(scene);
    expect(candidate).toBeDefined();
    expect(candidate!.centerX).toBeCloseTo(164, -1);
    expect(candidate!.centerY).toBeCloseTo(174, -1);
    expect(candidate!.radiusMajor).toBeCloseTo(104, -1);
    expect(candidate!.radiusMinor).toBeCloseTo(43, -1);
    expect(candidate!.visibleArcFraction).toBeGreaterThanOrEqual(0.8);
  });

  it.each([
    { missingSectors: Array.from({ length: 18 }, (_, index) => index) },
    { missingSectors: Array.from({ length: 18 }, (_, index) => index + 18) },
    { missingSectors: Array.from({ length: 18 }, (_, index) => index + 36) },
    { missingSectors: Array.from({ length: 18 }, (_, index) => index + 54) },
  ])("does not accept a rim with an entire quadrant missing", ({ missingSectors }) => {
    const candidates = detectWheelEllipses(renderWheelScene({ missingSectors }));

    expect(candidates.every((candidate) => candidate.visibleArcFraction < 0.8 || candidate.confidence < 0.8)).toBe(
      true,
    );
  });

  it("does not mistake a filled face-like oval for a wheel rim", () => {
    const scene = renderWheelScene({
      rim: 118,
      clutter: true,
      missingSectors: Array.from({ length: 72 }, (_, i) => i),
    });

    expect(detectWheelEllipses(scene).filter((candidate) => candidate.confidence >= 0.8)).toEqual([]);
  });
});
