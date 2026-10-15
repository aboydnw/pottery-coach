import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { CONFIDENT_DETECTION, type WheelHeadDetection } from "./wheelHead";
import { moveMarker, type WheelEdges } from "./wheelMarkers";

type Edge = "left" | "right";

type Props = {
  still: ImageData;
  /** Detected edges in full-resolution image pixels; only the row and confidence are used here. */
  detection: WheelHeadDetection;
  /** Current marker positions in image pixels; the parent owns them so voice and touch move the same markers. */
  edges: WheelEdges;
  onEdgesChange(edges: WheelEdges): void;
  /** Show the still mirrored to match a front-camera preview. Marker positions stay in image pixels. */
  mirrored: boolean;
  onConfirm(): void;
  onRetry(): void;
};

/** Shows a still with draggable, keyboard-adjustable markers on the wheel head's edges. */
export function WheelHeadConfirm({ still, detection, edges, onEdgesChange, mirrored, onConfirm, onRetry }: Props) {
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

  function nudge(edge: Edge, event: KeyboardEvent<SVGGElement>): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const step = (event.shiftKey ? 0.02 : 0.002) * width;
    const visualDirection = event.key === "ArrowRight" ? 1 : -1;
    move(edge, edges[edge] + step * visualDirection * (mirrored ? -1 : 1));
  }

  return (
    <section className="wheel-head-confirm" aria-labelledby="wheel-confirm-title">
      <h2 id="wheel-confirm-title">Check the wheel-head edges</h2>
      <p role="status">
        {confident
          ? "Line the markers up with the outer edges of the wheel head (or bat)."
          : "We couldn't find the edges clearly. Drag the markers onto the outer edges of the wheel head (or bat)."}
      </p>
      <div className={mirrored ? "wheel-still mirrored" : "wheel-still"}>
        <canvas ref={canvasRef} width={width} height={height} aria-hidden="true" />
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
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
                event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
                setDragging(edge);
              }}
            >
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
