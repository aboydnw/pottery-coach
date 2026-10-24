import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AboutScreen } from "./AboutScreen";

afterEach(cleanup);

it("contains the moved setup, privacy, safety, voice, and storage explanation", () => {
  render(<AboutScreen voiceAvailable demoMode={false} onHome={vi.fn()} onStart={vi.fn()} />);
  expect(screen.getByText(/empty wheel/i)).toBeInTheDocument();
  expect(screen.getByText(/processed on this device/i)).toBeInTheDocument();
  expect(screen.getByText(/not safety equipment/i)).toBeInTheDocument();
  expect(screen.getByText(/speech service/i)).toBeInTheDocument();
  expect(screen.getByText(/30 days/i)).toBeInTheDocument();
});

it("offers Home and Start Session actions", () => {
  const onHome = vi.fn();
  const onStart = vi.fn();
  render(<AboutScreen voiceAvailable={false} demoMode onHome={onHome} onStart={onStart} />);
  fireEvent.click(screen.getByRole("button", { name: /go home/i }));
  fireEvent.click(screen.getByRole("button", { name: /start session/i }));
  expect(onHome).toHaveBeenCalledOnce();
  expect(onStart).toHaveBeenCalledOnce();
});
