import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { WheelHeadConfirm } from "./WheelHeadConfirm";
import type { WheelEdges } from "./wheelMarkers";

afterEach(cleanup);

const still = { width: 1000, height: 500, data: new Uint8ClampedArray(1000 * 500 * 4) } as unknown as ImageData;
const detection = { leftX: 200, rightX: 800, row: 400, confidence: 0.9 };

function Harness({
  mirrored = false,
  confidence = 0.9,
  onChange,
}: {
  mirrored?: boolean;
  confidence?: number;
  onChange: (edges: WheelEdges) => void;
}) {
  const [edges, setEdges] = useState<WheelEdges>({ left: 200, right: 800 });
  return (
    <WheelHeadConfirm
      still={still}
      detection={{ ...detection, confidence }}
      edges={edges}
      onEdgesChange={(next) => {
        setEdges(next);
        onChange(next);
      }}
      mirrored={mirrored}
      onConfirm={vi.fn()}
      onRetry={vi.fn()}
    />
  );
}

it("nudges a marker with the arrow keys, in bigger steps with Shift", () => {
  const onChange = vi.fn();
  render(<Harness onChange={onChange} />);
  const left = screen.getByRole("slider", { name: /left edge/i });
  fireEvent.keyDown(left, { key: "ArrowRight" });
  fireEvent.keyDown(left, { key: "ArrowLeft", shiftKey: true });
  expect(onChange).toHaveBeenLastCalledWith({ left: 182, right: 800 });
});

it("moves markers the way the user sees them when the still is mirrored", () => {
  const onChange = vi.fn();
  render(<Harness mirrored onChange={onChange} />);
  fireEvent.keyDown(screen.getByRole("slider", { name: /right edge/i }), { key: "ArrowRight" });
  expect(onChange).toHaveBeenLastCalledWith({ left: 200, right: 798 });
});

it("asks the user to place the markers when detection is unsure", () => {
  render(<Harness confidence={0.1} onChange={vi.fn()} />);
  expect(screen.getByRole("status")).toHaveTextContent(/couldn't find the edges/i);
});

it("confirms or retries on request", () => {
  const onConfirm = vi.fn();
  const onRetry = vi.fn();
  render(
    <WheelHeadConfirm
      still={still}
      detection={detection}
      edges={{ left: 200, right: 800 }}
      onEdgesChange={vi.fn()}
      mirrored={false}
      onConfirm={onConfirm}
      onRetry={onRetry}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /looks right/i }));
  fireEvent.click(screen.getByRole("button", { name: /try again/i }));
  expect(onConfirm).toHaveBeenCalledOnce();
  expect(onRetry).toHaveBeenCalledOnce();
});
