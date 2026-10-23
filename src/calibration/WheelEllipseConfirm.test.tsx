import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WheelEllipseConfirm } from "./WheelEllipseConfirm";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const still = { width: 640, height: 480, data: new Uint8ClampedArray(640 * 480 * 4) } as ImageData;
const ellipse = {
  centerX: 320,
  centerY: 380,
  radiusMajor: 150,
  radiusMinor: 75,
  rotationRad: 0,
  fitResidualPx95: 0.5,
  visibleArcFraction: 1,
  confidence: 0.95,
};

it("automatically accepts a stable supported ellipse after 750 ms", () => {
  vi.useFakeTimers();
  const onConfirm = vi.fn();
  render(
    <WheelEllipseConfirm
      still={still}
      ellipse={ellipse}
      diameterMm={300}
      mirrored={false}
      canSwitch={{ inner: false, outer: false }}
      onEllipseChange={vi.fn()}
      onSwitch={vi.fn()}
      onConfirm={onConfirm}
      onRetry={vi.fn()}
    />,
  );
  vi.advanceTimersByTime(749);
  expect(onConfirm).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(onConfirm).toHaveBeenCalledWith(ellipse);
});

it("does not auto-accept incomplete geometry and shows a useful correction", () => {
  vi.useFakeTimers();
  const onConfirm = vi.fn();
  render(
    <WheelEllipseConfirm
      still={still}
      ellipse={{ ...ellipse, visibleArcFraction: 0.4, confidence: 0.3 }}
      diameterMm={300}
      mirrored={false}
      canSwitch={{ inner: false, outer: false }}
      onEllipseChange={vi.fn()}
      onSwitch={vi.fn()}
      onConfirm={onConfirm}
      onRetry={vi.fn()}
    />,
  );
  vi.advanceTimersByTime(1_000);
  expect(onConfirm).not.toHaveBeenCalled();
  expect(screen.getByRole("status")).toHaveTextContent(/whole wheel rim/i);
});

it("adjust mode cancels automatic acceptance and exposes ellipse controls", () => {
  vi.useFakeTimers();
  const onConfirm = vi.fn();
  render(
    <WheelEllipseConfirm
      still={still}
      ellipse={ellipse}
      diameterMm={300}
      mirrored={false}
      canSwitch={{ inner: true, outer: false }}
      onEllipseChange={vi.fn()}
      onSwitch={vi.fn()}
      onConfirm={onConfirm}
      onRetry={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /adjust/i }));
  vi.advanceTimersByTime(1_000);
  expect(onConfirm).not.toHaveBeenCalled();
  expect(screen.getByRole("slider", { name: /wheel width/i })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /inner outline/i }));
});
