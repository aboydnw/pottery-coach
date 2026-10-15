export type WheelEdges = { left: number; right: number };

const MIN_GAP_FRACTION = 0.05;
const STEP_FRACTION = { small: 0.005, large: 0.03 } as const;

/** Places one marker at `x`, kept inside the image and never crossing the other marker. */
export function moveMarker(edges: WheelEdges, side: keyof WheelEdges, x: number, width: number): WheelEdges {
  const minGap = width * MIN_GAP_FRACTION;
  const clamped = Math.round(Math.min(width - 1, Math.max(0, x)));
  return side === "left"
    ? { ...edges, left: Math.min(clamped, edges.right - minGap) }
    : { ...edges, right: Math.max(clamped, edges.left + minGap) };
}

/**
 * Moves a marker by a spoken amount. "out" is away from the wheel's centre (left marker leftward,
 * right marker rightward); "in" is toward it.
 */
export function nudgeMarker(
  edges: WheelEdges,
  side: keyof WheelEdges,
  direction: "in" | "out",
  size: "small" | "large",
  width: number,
): WheelEdges {
  const outward = side === "left" ? -1 : 1;
  const step = STEP_FRACTION[size] * width * outward * (direction === "out" ? 1 : -1);
  return moveMarker(edges, side, edges[side] + step, width);
}
