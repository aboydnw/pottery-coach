import { describe, expect, it } from "vitest";
import { extractWheelEdges } from "./wheelEdges";

function image(width: number, height: number, pixel: (x: number, y: number) => number) {
  const gray = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) gray[y * width + x] = pixel(x, y);
  }
  return { gray, width, height };
}

describe("extractWheelEdges", () => {
  it("reports low contrast before attempting geometry", () => {
    const result = extractWheelEdges(image(80, 60, () => 120));

    expect(result.quality.reasons).toContain("LOW_CONTRAST");
    expect(result.points).toEqual([]);
  });

  it("reports glare on a broadly saturated search region", () => {
    const result = extractWheelEdges(image(80, 60, (x, y) => (y > 20 && x > 10 && x < 70 ? 255 : 90)));

    expect(result.quality.reasons).toContain("GLARE");
  });

  it.each([
    { left: 50, right: 190 },
    { left: 190, right: 50 },
  ])("finds both contrast polarities and preserves their normal direction", ({ left, right }) => {
    const result = extractWheelEdges(image(100, 80, (x) => (x < 50 ? left : right)));

    const boundary = result.points.filter((point) => Math.abs(point.x - 50) <= 1);
    expect(boundary.length).toBeGreaterThan(20);
    expect(boundary.some((point) => Math.sign(point.normalX) === Math.sign(right - left))).toBe(true);
  });

  it("does not emit edge points from the excluded upper camera region", () => {
    const result = extractWheelEdges(image(100, 100, (_x, y) => (y < 20 ? 30 : 180)));

    expect(result.points.every((point) => point.y >= 30)).toBe(true);
  });
});
