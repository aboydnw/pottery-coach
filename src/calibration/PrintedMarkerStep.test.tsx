import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { PrintedMarkerStep } from "./PrintedMarkerStep";

afterEach(cleanup);

it("explains the flat centered printed-page setup as the primary calibration path", () => {
  render(
    <PrintedMarkerStep
      initialDiameterMm={355.6}
      busy={false}
      onDiameter={vi.fn()}
      onCalibrate={vi.fn()}
      onUseWheelHead={vi.fn()}
      onSkip={vi.fn()}
    />,
  );
  expect(screen.getByRole("heading", { name: /calibrate with the printed page/i })).toBeVisible();
  expect(screen.getByText(/place it flat on the wheel head/i)).toBeVisible();
  expect(screen.getByRole("link", { name: /open printable page/i })).toHaveAttribute(
    "href",
    "/calibration/board-v1.svg",
  );
  expect(screen.getByRole("button", { name: /detect printed page/i })).toBeDisabled();
});

it("requires ruler confirmation and passes the remembered diameter to calibration", () => {
  const onDiameter = vi.fn();
  const onCalibrate = vi.fn();
  render(
    <PrintedMarkerStep
      initialDiameterMm={355.6}
      busy={false}
      onDiameter={onDiameter}
      onCalibrate={onCalibrate}
      onUseWheelHead={vi.fn()}
      onSkip={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("checkbox", { name: /line measures exactly 100 mm/i }));
  fireEvent.click(screen.getByRole("button", { name: /detect printed page/i }));
  expect(onDiameter).toHaveBeenCalledWith(355.6);
  expect(onCalibrate).toHaveBeenCalledOnce();
});

it("labels wheel-head detection as an optional fallback", () => {
  const onUseWheelHead = vi.fn();
  render(
    <PrintedMarkerStep
      initialDiameterMm={355.6}
      busy={false}
      onDiameter={vi.fn()}
      onCalibrate={vi.fn()}
      onUseWheelHead={onUseWheelHead}
      onSkip={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /optional wheel-head detection/i }));
  expect(onUseWheelHead).toHaveBeenCalledOnce();
});
