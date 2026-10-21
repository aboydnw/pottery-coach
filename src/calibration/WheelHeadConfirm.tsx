import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { CONFIDENT_DETECTION, type WheelHeadDetection } from "./wheelHead";
import { moveMarker, type WheelEdges } from "./wheelMarkers";

type Edge = "left" | "right";

/** One tap of an arrow button moves a line this share of the picture's width. */
const BUTTON_STEP_FRACTION = 0.01;

type Props = {
  still: ImageData;
  /** Detected edges in full-resolution image pixels; only the row and confidence are used here. */
  detection: WheelHeadDetection;
  /** Current marker positions in image pixels; the parent owns them so voice and touch move the same markers. */
  edges: WheelEdges;
  onEdgesChange(edges: WheelEdges): void;
  /** Show the still mirrored to match a front-camera preview. Marker positions stay in image pixels. */
  mirrored: boolean;
  /** Whether there's another detected edge pair inside or outside this one (a tray around the wheel head). */
  canSwitch: { inner: boolean; outer: boolean };
  onSwitch(toward: "inner" | "outer"): void;
  onConfirm(): void;
  onRetry(): void;
};

/**
 * Shows a still with the wheel-head edges marked. Lines can be dragged anywhere along their length,
 * moved by tapping where an edge should be, nudged with buttons, or switched to the next edges found.
 */
export function WheelHeadConfirm({
  still,
  detection,
  edges,
  onEdgesChange,
  mirrored,
  canSwitch,
  onSwitch,
  onConfirm,
  onRetry,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState<Edge | null>(null);
  const { width, height } = still;
  const confident = detection.confidence >= CONFIDENT_DETECTION;

  useEffect(() => {
    canvasRef.current?.getContext("2d")?.putImageData(still, 0, 0);
  }, [still]);

  function move(edge: Edge, x: number): void {
    onEdgesChange(moveMarker(edges, edge, x, width));
  }

  function pointerX(event: PointerEvent<SVGSVGElement>): number {
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - rect.left) / rect.width;
    return (mirrored ? 1 - fraction : fraction) * width;
  }

  /** Moves a line by one step towards the screen's left or right, whichever way the still is shown. */
  function step(edge: Edge, screenDirection: -1 | 1, fraction = BUTTON_STEP_FRACTION): void {
    move(edge, edges[edge] + fraction * width * screenDirection * (mirrored ? -1 : 1));
  }

  function nudge(edge: Edge, event: KeyboardEvent<SVGGElement>): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    step(edge, event.key === "ArrowRight" ? 1 : -1, event.shiftKey ? 0.02 : 0.002);
  }

  // Which line is on the screen's left depends on mirroring.
  const screenOrder: Edge[] = mirrored ? ["right", "left"] : ["left", "right"];

  return (
    <section className="wheel-head-confirm" aria-labelledby="wheel-confirm-title">
      <h2 id="wheel-confirm-title">Check the wheel-head edges</h2>
      <p role="status">
        {confident
          ? "Are the yellow lines on the outer edges of the wheel head (or bat)? Drag a line, tap where an edge should be, or use the arrows."
          : "We couldn't find the edges clearly. Drag the yellow lines, or tap where each edge of the wheel head (or bat) is."}
      </p>
      <div className={mirrored ? "wheel-still mirrored" : "wheel-still"}>
        <canvas ref={canvasRef} width={width} height={height} aria-hidden="true" />
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          onPointerDown={(event) => {
            if (dragging) return;
            // A tap away from both lines moves the nearer one there.
            const x = pointerX(event);
            move(Math.abs(x - edges.left) <= Math.abs(x - edges.right) ? "left" : "right", x);
          }}
          onPointerMove={(event) => dragging && move(dragging, pointerX(event))}
          onPointerUp={() => setDragging(null)}
          onPointerCancel={() => setDragging(null)}
        >
          <line x1={0} x2={width} y1={detection.row} y2={detection.row} className="wheel-row" />
          {(["left", "right"] as const).map((edge) => (
            <g
              key={edge}
              role="slider"
              tabIndex={0}
              aria-label={`${edge === "left" ? "Left" : "Right"} edge of the wheel head`}
              aria-valuemin={0}
              aria-valuemax={width}
              aria-valuenow={edges[edge]}
              aria-valuetext={`${Math.round((edges[edge] / width) * 100)}% across the image`}
              className="wheel-marker"
              onKeyDown={(event) => nudge(edge, event)}
              onPointerDown={(event) => {
                event.stopPropagation();
                event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
                setDragging(edge);
              }}
            >
              {/* A wide, invisible strip along the whole line, so it's easy to grab on a phone. */}
              <rect
                className="wheel-marker-hit"
                x={edges[edge] - width * 0.06}
                y={0}
                width={width * 0.12}
                height={height}
              />
              <line x1={edges[edge]} x2={edges[edge]} y1={0} y2={height} />
              <rect
                x={edges[edge] - width * 0.03}
                y={detection.row - height * 0.08}
                width={width * 0.06}
                height={height * 0.16}
                rx={width * 0.01}
              />
            </g>
          ))}
        </svg>
      </div>
      <div className="wheel-nudges">
        {screenOrder.map((edge, index) => (
          <div key={edge} className="wheel-nudge" role="group" aria-label={`${index === 0 ? "Left" : "Right"} line`}>
            <button
              type="button"
              className="secondary"
              aria-label={`Move the ${index === 0 ? "left" : "right"} line left`}
              onClick={() => step(edge, -1)}
            >
              ◀
            </button>
            <span aria-hidden="true">{index === 0 ? "Left line" : "Right line"}</span>
            <button
              type="button"
              className="secondary"
              aria-label={`Move the ${index === 0 ? "left" : "right"} line right`}
              onClick={() => step(edge, 1)}
            >
              ▶
            </button>
          </div>
        ))}
      </div>
      {(canSwitch.inner || canSwitch.outer) && (
        <div className="actions">
          {canSwitch.inner && (
            <button type="button" className="secondary" onClick={() => onSwitch("inner")}>
              Try the inner edge (lines are on a tray)
            </button>
          )}
          {canSwitch.outer && (
            <button type="button" className="secondary" onClick={() => onSwitch("outer")}>
              Try the outer edge
            </button>
          )}
        </div>
      )}
      <div className="actions">
        <button type="button" onClick={() => onConfirm()}>
          Looks right
        </button>
        <button type="button" className="secondary" onClick={onRetry}>
          Try again
        </button>
      </div>
    </section>
  );
}
