import { describe, expect, it } from "vitest";
import type { WheelEdgeMap, WheelEdgePoint } from "./wheelEdges";
import { fitWheelEllipseProposals, traceWheelArcs } from "./wheelArcs";

function point(x: number, y: number): WheelEdgePoint {
  const length = Math.hypot(x - 100, y - 80) || 1;
  return { x, y, strength: 100, normalX: (x - 100) / length, normalY: (y - 80) / length, polarity: 1 };
}

function map(points: WheelEdgePoint[]): WheelEdgeMap {
  return {
    width: 220,
    height: 160,
    points,
    quality: { blurScore: 1, contrastScore: 1, glareFraction: 0, reasons: [] },
  };
}

describe("traceWheelArcs", () => {
  it("groups a smooth ellipse edge while dropping isolated texture", () => {
    const ellipse = Array.from({ length: 180 }, (_, index) => {
      const angle = (index / 180) * Math.PI * 2;
      return point(Math.round(110 + 72 * Math.cos(angle)), Math.round(112 + 28 * Math.sin(angle)));
    });
    const arcs = traceWheelArcs(map([...ellipse, point(8, 52), point(190, 48)]));

    expect(arcs).toHaveLength(1);
    expect(arcs[0]!.points.length).toBeGreaterThan(100);
  });

  it("rejects a long straight edge", () => {
    const line = Array.from({ length: 120 }, (_, index) => point(40 + index, 100));

    expect(traceWheelArcs(map(line))).toEqual([]);
  });
});

describe("fitWheelEllipseProposals", () => {
  it("recovers ellipse geometry from a complete curved trace", () => {
    const points = Array.from({ length: 240 }, (_, index) => {
      const angle = (index / 240) * Math.PI * 2;
      return point(Math.round(110 + 72 * Math.cos(angle)), Math.round(112 + 28 * Math.sin(angle)));
    });
    const arcs = traceWheelArcs(map(points));
    const [ellipse] = fitWheelEllipseProposals(arcs, { width: 220, height: 160 });

    expect(ellipse).toBeDefined();
    expect(ellipse!.centerX).toBeCloseTo(110, 0);
    expect(ellipse!.centerY).toBeCloseTo(112, 0);
    expect(ellipse!.radiusMajor).toBeCloseTo(72, -1);
    expect(ellipse!.radiusMinor).toBeCloseTo(28, -1);
  });

  it("rejects an implausibly narrow fit", () => {
    const points = Array.from({ length: 180 }, (_, index) => {
      const angle = (index / 180) * Math.PI * 2;
      return point(Math.round(110 + 80 * Math.cos(angle)), Math.round(112 + 5 * Math.sin(angle)));
    });

    expect(fitWheelEllipseProposals(traceWheelArcs(map(points)), { width: 220, height: 160 })).toEqual([]);
  });
});
