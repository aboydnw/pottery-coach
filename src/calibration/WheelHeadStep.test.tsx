import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WheelHeadStep } from "./WheelHeadStep";

afterEach(cleanup);

it("finds the wheel head using a one-tap preset size", () => {
  const onFind = vi.fn();
  render(<WheelHeadStep initialDiameterMm={null} busy={false} onFind={onFind} />);
  expect(screen.getByRole("button", { name: /find wheel head/i })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "14 in" }));
  fireEvent.click(screen.getByRole("button", { name: /find 14 in wheel head/i }));
  expect(onFind.mock.calls[0]![0]).toBeCloseTo(355.6);
});

it("preselects a remembered custom size and accepts centimetres", () => {
  const onFind = vi.fn();
  render(<WheelHeadStep initialDiameterMm={340} busy={false} onFind={onFind} />);
  expect(screen.getByRole("button", { name: /other size/i })).toHaveAttribute("aria-pressed", "true");
  fireEvent.change(screen.getByLabelText(/unit/i), { target: { value: "cm" } });
  fireEvent.change(screen.getByLabelText(/diameter/i), { target: { value: "33" } });
  fireEvent.click(screen.getByRole("button", { name: /find 33 cm wheel head/i }));
  expect(onFind.mock.calls[0]![0]).toBeCloseTo(330);
});

it("explains that remembered size does not reuse the camera view", () => {
  render(<WheelHeadStep initialDiameterMm={355.6} busy={false} onFind={vi.fn()} />);
  expect(screen.getByText(/remember this size/i)).toBeVisible();
  expect(screen.getByText(/check the camera view each time/i)).toBeVisible();
});

it("explains an implausible custom size instead of searching", () => {
  render(<WheelHeadStep initialDiameterMm={null} busy={false} onFind={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: /other size/i }));
  fireEvent.change(screen.getByLabelText(/diameter/i), { target: { value: "3" } });
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /find wheel head/i })).toBeDisabled();
});
