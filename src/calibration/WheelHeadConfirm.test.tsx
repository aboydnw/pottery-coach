import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WheelHeadConfirm } from "./WheelHeadConfirm";

afterEach(cleanup);

const still = { width: 1000, height: 500, data: new Uint8ClampedArray(1000 * 500 * 4) } as unknown as ImageData;
const detection = { leftX: 200, rightX: 800, row: 400, confidence: 0.9 };

it("confirms the detected edges unchanged when the user accepts them", () => {
  const onConfirm = vi.fn();
  render(
    <WheelHeadConfirm still={still} detection={detection} mirrored={false} onConfirm={onConfirm} onRetry={vi.fn()} />,
  );
  fireEvent.click(screen.getByRole("button", { name: /looks right/i }));
  expect(onConfirm).toHaveBeenCalledWith({ leftX: 200, rightX: 800, row: 400, adjustedByUser: false });
});

it("nudges a marker with the arrow keys, in bigger steps with Shift", () => {
  const onConfirm = vi.fn();
  render(
    <WheelHeadConfirm still={still} detection={detection} mirrored={false} onConfirm={onConfirm} onRetry={vi.fn()} />,
  );
  const left = screen.getByRole("slider", { name: /left edge/i });
  fireEvent.keyDown(left, { key: "ArrowRight" });
  fireEvent.keyDown(left, { key: "ArrowLeft", shiftKey: true });
  fireEvent.click(screen.getByRole("button", { name: /looks right/i }));
  expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ leftX: 182, adjustedByUser: true }));
});

it("moves markers the way the user sees them when the still is mirrored", () => {
  const onConfirm = vi.fn();
  render(<WheelHeadConfirm still={still} detection={detection} mirrored onConfirm={onConfirm} onRetry={vi.fn()} />);
  fireEvent.keyDown(screen.getByRole("slider", { name: /right edge/i }), { key: "ArrowRight" });
  fireEvent.click(screen.getByRole("button", { name: /looks right/i }));
  expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ rightX: 798 }));
});

it("asks the user to place the markers when detection is unsure", () => {
  render(
    <WheelHeadConfirm
      still={still}
      detection={{ ...detection, confidence: 0.1 }}
      mirrored={false}
      onConfirm={vi.fn()}
      onRetry={vi.fn()}
    />,
  );
  expect(screen.getByRole("status")).toHaveTextContent(/couldn't find the edges/i);
});
