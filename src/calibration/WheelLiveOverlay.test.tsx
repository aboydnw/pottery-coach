import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { WheelLiveOverlay } from "./WheelLiveOverlay";

afterEach(cleanup);

const ellipse = {
  centerX: 320,
  centerY: 360,
  radiusMajor: 150,
  radiusMinor: 75,
  rotationRad: 0,
  fitResidualPx95: 0.5,
  visibleArcFraction: 1,
  confidence: 0.95,
};

it("draws wheel geometry over the live feed without a copied image surface", () => {
  const { container } = render(
    <WheelLiveOverlay
      frameSize={{ width: 640, height: 480 }}
      ellipse={ellipse}
      diameterMm={355.6}
      status="steady"
      mirrored={false}
      adjusted={false}
      canSwitch={{ inner: true, outer: false }}
      onEllipseChange={vi.fn()}
      onAdjustStart={vi.fn()}
      onSwitch={vi.fn()}
      onConfirm={vi.fn()}
      onRetry={vi.fn()}
    />,
  );

  expect(screen.getByRole("status")).toHaveTextContent(/hold steady/i);
  expect(screen.getByLabelText(/live detected wheel outline/i)).toHaveAttribute("viewBox", "0 0 640 480");
  expect(container.querySelector("ellipse")?.getAttribute("cx")).toBe("320");
  expect(container.querySelector("canvas")).toBeNull();
  expect(container.querySelector("img")).toBeNull();
  expect(screen.getByRole("button", { name: /inner outline/i })).toBeVisible();
});

it("keeps manual controls compact and confirms the adjusted live outline", () => {
  const onAdjustStart = vi.fn();
  const onConfirm = vi.fn();
  const { rerender } = render(
    <WheelLiveOverlay
      frameSize={{ width: 640, height: 480 }}
      ellipse={ellipse}
      diameterMm={355.6}
      status="steady"
      mirrored={false}
      adjusted={false}
      canSwitch={{ inner: false, outer: false }}
      onEllipseChange={vi.fn()}
      onAdjustStart={onAdjustStart}
      onSwitch={vi.fn()}
      onConfirm={onConfirm}
      onRetry={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: /adjust manually/i }));
  expect(onAdjustStart).toHaveBeenCalledOnce();
  rerender(
    <WheelLiveOverlay
      frameSize={{ width: 640, height: 480 }}
      ellipse={ellipse}
      diameterMm={355.6}
      status="steady"
      mirrored={false}
      adjusted
      canSwitch={{ inner: false, outer: false }}
      onEllipseChange={vi.fn()}
      onAdjustStart={onAdjustStart}
      onSwitch={vi.fn()}
      onConfirm={onConfirm}
      onRetry={vi.fn()}
    />,
  );
  expect(screen.getByRole("slider", { name: /wheel width/i })).toBeVisible();
  const controls = screen.getByRole("group", { name: /manual outline controls/i });
  expect(controls).toHaveClass("at-top");
  fireEvent.click(screen.getByRole("button", { name: /move controls to bottom/i }));
  expect(controls).toHaveClass("at-bottom");
  fireEvent.click(screen.getByRole("button", { name: /use this outline/i }));
  expect(onConfirm).toHaveBeenCalledWith(ellipse);
});
