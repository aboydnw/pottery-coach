import { expect, it } from "vitest";
import {
  CONFIDENT_DETECTION,
  detectWheelHead,
  toGray,
  wheelEllipseCalibration,
  wheelHeadCalibration,
} from "./wheelHead";

type Scene = {
  width: number;
  height: number;
  centerX: number;
  row: number;
  halfWidth: number;
  withPot?: boolean;
  noise?: number;
  seed?: number;
  /** Half-width of a splash pan drawn around the wheel head. */
  trayHalfWidth?: number;
};

function renderScene({
  width,
  height,
  centerX,
  row,
  halfWidth,
  withPot = true,
  noise = 4,
  seed = 1,
  trayHalfWidth,
}: Scene) {
  let state = seed;
  const random = () => (state = (1664525 * state + 1013904223) >>> 0) / 2 ** 32;
  const gray = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = 150;
      const dx = (x - centerX) / halfWidth;
      const dy = (y - row) / 24;
      const tx = trayHalfWidth ? (x - centerX) / trayHalfWidth : Infinity;
      const ty = (y - row) / 36;
      if (tx * tx + ty * ty <= 1) value = 110;
      if (dx * dx + dy * dy <= 1) value = 70;
      if (withPot && y < row - 2 && y < height && y > row - 70 && Math.abs(x - centerX) < halfWidth * 0.35) value = 205;
      gray[y * width + x] = value + (random() - 0.5) * 2 * noise;
    }
  }
  return { gray, width, height };
}

it("finds a wheel rim when only small circumference gaps are obscured", () => {
  const detection = detectWheelHead(renderScene({ width: 320, height: 180, centerX: 165, row: 140, halfWidth: 100 }));
  expect(detection.confidence).toBeGreaterThan(CONFIDENT_DETECTION);
});

it("finds an off-centre wheel head with no pot on it", () => {
  const detection = detectWheelHead(
    renderScene({ width: 320, height: 180, centerX: 140, row: 120, halfWidth: 80, withPot: false }),
  );
  expect(Math.abs(detection.leftX - 60)).toBeLessThanOrEqual(5);
  expect(Math.abs(detection.rightX - 220)).toBeLessThanOrEqual(5);
});

it("prefers the round wheel head near the bottom over a larger foreground object", () => {
  const width = 320;
  const height = 240;
  const gray = new Float32Array(width * height).fill(185);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const foreground = ((x - 150) / 125) ** 2 + ((y - 115) / 36) ** 2 <= 1;
      const wheel = ((x - 165) / 100) ** 2 + ((y - 205) / 24) ** 2 <= 1;
      if (foreground) gray[y * width + x] = 65;
      if (wheel) gray[y * width + x] = 118;
    }
  }

  const detection = detectWheelHead({ gray, width, height });

  expect(detection.ellipse?.centerX).toBeCloseTo(165, 0);
  expect(detection.ellipse?.centerY).toBeCloseTo(205, 0);
  expect(detection.ellipse?.radiusMajor).toBeCloseTo(100, 0);
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

it("also finds the wheel head inside a splash pan around it", () => {
  const scene = renderScene({
    width: 320,
    height: 180,
    centerX: 160,
    row: 130,
    halfWidth: 80,
    trayHalfWidth: 140,
    withPot: false,
  });
  const detection = detectWheelHead(scene);
  expect(Math.abs(detection.leftX - 20)).toBeLessThanOrEqual(3);
  expect(detection.candidates).toHaveLength(2);
  expect(Math.abs(detection.candidates[1]!.leftX - 80)).toBeLessThanOrEqual(3);
  expect(Math.abs(detection.candidates[1]!.rightX - 240)).toBeLessThanOrEqual(3);
});

it("creates an angled calibration from a complete wheel ellipse", () => {
  const result = wheelEllipseCalibration({
    ellipse: {
      centerX: 640,
      centerY: 600,
      radiusMajor: 400,
      radiusMinor: 200,
      rotationRad: 0,
      fitResidualPx95: 1,
      visibleArcFraction: 0.95,
      confidence: 0.95,
    },
    diameterMm: 356,
    frameWidth: 1280,
    frameHeight: 720,
    adjustedByUser: false,
  });
  expect(result.status).toBe("accepted");
  expect(result.wheelViewPose?.downwardAngleRad).toBeCloseTo(Math.acos(0.5));
  expect(result.wheelEllipse?.radiusMajor).toBe(400);
  expect(result.provenance).toBe("automatic");
});

it("does not let manual ellipse adjustment bypass a clipped working region", () => {
  const result = wheelEllipseCalibration({
    ellipse: {
      centerX: 640,
      centerY: 180,
      radiusMajor: 400,
      radiusMinor: 160,
      rotationRad: 0,
      fitResidualPx95: 1,
      visibleArcFraction: 1,
      confidence: 0.95,
    },
    diameterMm: 356,
    frameWidth: 1280,
    frameHeight: 720,
    adjustedByUser: true,
  });
  expect(result.status).toBe("rejected");
  expect(result.reasons).toContain("WORKING_REGION_CLIPPED");
  expect(result.provenance).toBe("manual-assisted");
});

it("accepts a manually confirmed outline when automatic rim evidence was unavailable", () => {
  const result = wheelEllipseCalibration({
    ellipse: {
      centerX: 640,
      centerY: 600,
      radiusMajor: 400,
      radiusMinor: 200,
      rotationRad: 0,
      fitResidualPx95: 400,
      visibleArcFraction: 0,
      confidence: 0,
    },
    diameterMm: 356,
    frameWidth: 1280,
    frameHeight: 720,
    adjustedByUser: true,
  });

  expect(result.status).toBe("accepted");
  expect(result.provenance).toBe("manual-assisted");
});
