import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import type { DatasetFrameCapture } from "../workerProtocol";
import { paintMask } from "./maskEditing";
import type { CaptureCondition, ReviewVerdict } from "./types";

export type ClayMaskReview = {
  verdict: ReviewVerdict;
  correctedMask: Uint8Array | null;
  conditions: CaptureCondition[];
};

type Props = {
  capture: DatasetFrameCapture;
  onSave(review: ClayMaskReview): void;
  onCancel(): void;
};

const CONDITIONS: Array<{ value: CaptureCondition; label: string }> = [
  { value: "wet-clay", label: "Wet clay" },
  { value: "dry-clay", label: "Dry clay" },
  { value: "hands", label: "Hands in frame" },
  { value: "tools", label: "Tools in frame" },
  { value: "bat", label: "Bat on wheel" },
  { value: "glare", label: "Glare" },
  { value: "low-light", label: "Low light" },
  { value: "empty-wheel", label: "Empty wheel" },
];

export function ClayMaskEditor({ capture, onSave, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [mask, setMask] = useState<Uint8Array>(() => capture.automaticMask.slice());
  const [history, setHistory] = useState<Uint8Array[]>([]);
  const [tool, setTool] = useState<"paint" | "erase">("paint");
  const [radius, setRadius] = useState(8);
  const [conditions, setConditions] = useState<CaptureCondition[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const pixels = context.createImageData(capture.width, capture.height);
    pixels.data.set(capture.rgba);
    for (let index = 0; index < mask.length; index += 1) {
      if (!mask[index]) continue;
      const offset = index * 4;
      pixels.data[offset] = Math.round(pixels.data[offset]! * 0.55 + 255 * 0.45);
      pixels.data[offset + 1] = Math.round(pixels.data[offset + 1]! * 0.55 + 200 * 0.45);
      pixels.data[offset + 2] = Math.round(pixels.data[offset + 2]! * 0.55);
    }
    context.putImageData(pixels, 0, 0);
  }, [capture, mask]);

  const applyBrush = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = ((event.clientX - bounds.left) / bounds.width) * capture.width;
    const y = ((event.clientY - bounds.top) / bounds.height) * capture.height;
    setMask((current) =>
      paintMask(current, {
        width: capture.width,
        height: capture.height,
        x,
        y,
        radius,
        value: tool === "paint" ? 1 : 0,
      }),
    );
  };

  const beginDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = true;
    setHistory((current) => [...current.slice(-19), mask.slice()]);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    applyBrush(event);
  };

  const finish = (verdict: ReviewVerdict, correctedMask: Uint8Array | null) =>
    onSave({ verdict, correctedMask, conditions });

  return (
    <section className="clay-mask-editor" aria-labelledby="clay-mask-editor-title">
      <h3 id="clay-mask-editor-title">Review the clay outline</h3>
      <p>Yellow is what the detector believes is clay. Paint missing clay or erase anything extra.</p>
      <canvas
        ref={canvasRef}
        width={capture.width}
        height={capture.height}
        aria-label="Clay outline editor"
        onPointerDown={beginDrawing}
        onPointerMove={(event) => drawingRef.current && applyBrush(event)}
        onPointerUp={() => (drawingRef.current = false)}
        onPointerCancel={() => (drawingRef.current = false)}
      />
      <div className="clay-mask-editor-tools" role="toolbar" aria-label="Outline tools">
        <button type="button" aria-pressed={tool === "paint"} onClick={() => setTool("paint")}>
          Paint clay
        </button>
        <button type="button" aria-pressed={tool === "erase"} onClick={() => setTool("erase")}>
          Erase
        </button>
        <label>
          Brush size{" "}
          <input
            type="range"
            min="2"
            max="30"
            value={radius}
            onChange={(event) => setRadius(Number(event.target.value))}
          />
        </label>
        <button
          type="button"
          disabled={history.length === 0}
          onClick={() => {
            const previous = history.at(-1);
            if (!previous) return;
            setMask(previous);
            setHistory((current) => current.slice(0, -1));
          }}
        >
          Undo
        </button>
        <button
          type="button"
          onClick={() => {
            setHistory((current) => [...current.slice(-19), mask.slice()]);
            setMask(capture.automaticMask.slice());
          }}
        >
          Reset automatic outline
        </button>
      </div>
      <fieldset>
        <legend>What is visible?</legend>
        {CONDITIONS.map(({ value, label }) => (
          <label key={value}>
            <input
              type="checkbox"
              checked={conditions.includes(value)}
              onChange={(event) =>
                setConditions((current) =>
                  event.target.checked ? [...current, value] : current.filter((condition) => condition !== value),
                )
              }
            />{" "}
            {label}
          </label>
        ))}
      </fieldset>
      <div className="clay-mask-editor-decisions">
        <button type="button" onClick={() => finish("correct", capture.automaticMask)}>
          Outline is correct
        </button>
        <button type="button" onClick={() => finish("corrected", mask)}>
          Save corrected outline
        </button>
        <button type="button" className="secondary" onClick={() => finish("no-clay", null)}>
          No clay visible
        </button>
        <button type="button" className="secondary" onClick={() => finish("unusable", null)}>
          Frame is unusable
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
