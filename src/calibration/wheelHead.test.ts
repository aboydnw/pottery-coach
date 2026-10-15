import { expect, it } from "vitest";
import { CONFIDENT_DETECTION, detectWheelHead, toGray, wheelHeadCalibration } from "./wheelHead";

type Scene = {
  width: number;
  height: number;
  centerX: number;
  row: number;
  halfWidth: number;
  withPot?: boolean;
  noise?: number;
  seed?: number;
};

function renderScene({ width, height, centerX, row, halfWidth, withPot = true, noise = 4, seed = 1 }: Scene) {
  let state = seed;
  const random = () => (state = (1664525 * state + 1013904223) >>> 0) / 2 ** 32;
  const gray = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = 150;
      const dx = (x - centerX) / halfWidth;
      const dy = (y - row) / 5;
      if (dx * dx + dy * dy <= 1) value = 70;
      if (y < row - 2 && y < height && y > row - 70 && Math.abs(x - centerX) < halfWidth * 0.35) value = 205;
      if (!withPot && value === 205) value = 150;
      gray[y * width + x] = value + (random() - 0.5) * 2 * noise;
    }
  }
  return { gray, width, height };
}

it("finds both wheel-head edges beneath a pot", () => {
  const detection = detectWheelHead(renderScene({ width: 320, height: 180, centerX: 165, row: 140, halfWidth: 100 }));
  expect(Math.abs(detection.leftX - 65)).toBeLessThanOrEqual(2);
  expect(Math.abs(detection.rightX - 265)).toBeLessThanOrEqual(2);
  expect(Math.abs(detection.row - 140)).toBeLessThanOrEqual(3);
  expect(detection.confidence).toBeGreaterThanOrEqual(CONFIDENT_DETECTION);
});

it("finds an off-centre wheel head with no pot on it", () => {
  const detection = detectWheelHead(
    renderScene({ width: 320, height: 180, centerX: 140, row: 120, halfWidth: 80, withPot: false }),
  );
  expect(Math.abs(detection.leftX - 60)).toBeLessThanOrEqual(2);
  expect(Math.abs(detection.rightX - 220)).toBeLessThanOrEqual(2);
});

it("reports low confidence when there is no wheel head to find", () => {
  let state = 9;
  const random = () => (state = (1664525 * state + 1013904223) >>> 0) / 2 ** 32;
  const gray = Float32Array.from({ length: 320 * 180 }, () => 128 + (random() - 0.5) * 40);
  expect(detectWheelHead({ gray, width: 320, height: 180 }).confidence).toBeLessThan(CONFIDENT_DETECTION);
});

it("downscales RGBA to luminance by area averaging", () => {
  const rgba = new Uint8ClampedArray(4 * 4 * 4).fill(255);
  for (let pixel = 0; pixel < 16; pixel += 1) if (pixel % 4 < 2) rgba.set([0, 0, 0, 255], pixel * 4);
  const result = toGray(rgba, 4, 4, 2);
  expect(result).toMatchObject({ width: 2, height: 2, scale: 2 });
  expect(result.gray[0]).toBeCloseTo(0);
  expect(result.gray[1]).toBeCloseTo(255);
});

it("turns confirmed edges and a diameter into a scale-only calibration", () => {
  const result = wheelHeadCalibration({
    leftX: 240,
    rightX: 1040,
    row: 600,
    diameterMm: 356,
    frameWidth: 1280,
    frameHeight: 720,
    adjustedByUser: true,
  });
  expect(result.status).toBe("accepted");
  expect(result.method).toBe("wheel-head");
  expect(result.homographyImageToMm[0]).toBeCloseTo(356 / 800);
  expect(result.homographyImageToMm[4]).toBeCloseTo(356 / 800);
  expect(result.imageCenterlineX).toBe(640);
  expect(result.provenance).toBe("manual-assisted");
  expect(result.quality.estimatedErrorMm95).toBeLessThan(2);
});

it("rejects a wheel head that spans too little of the frame", () => {
  const result = wheelHeadCalibration({
    leftX: 600,
    rightX: 800,
    row: 600,
    diameterMm: 356,
    frameWidth: 1280,
    frameHeight: 720,
    adjustedByUser: false,
  });
  expect(result.status).toBe("rejected");
  expect(result.reasons).toContain("WHEEL_TOO_SMALL");
});

it("rejects edges in the wrong order", () => {
  const result = wheelHeadCalibration({
    leftX: 900,
    rightX: 300,
    row: 600,
    diameterMm: 356,
    frameWidth: 1280,
    frameHeight: 720,
    adjustedByUser: true,
  });
  expect(result.reasons).toContain("WHEEL_IMPLAUSIBLE");
});
