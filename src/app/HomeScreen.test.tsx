import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { HomeScreen } from "./HomeScreen";

afterEach(cleanup);

it("puts Start Session first and offers About navigation", () => {
  const onStart = vi.fn();
  const onAbout = vi.fn();
  render(<HomeScreen sessions={[]} onStart={onStart} onAbout={onAbout} onOpenSession={vi.fn()} />);

  const buttons = screen.getAllByRole("button");
  expect(buttons[0]).toHaveAccessibleName("Start session");
  fireEvent.click(buttons[0]!);
  fireEvent.click(screen.getByRole("button", { name: "About" }));
  expect(onStart).toHaveBeenCalledOnce();
  expect(onAbout).toHaveBeenCalledOnce();
});

it("renders past sessions and forwards selection", () => {
  const onOpenSession = vi.fn();
  render(
    <HomeScreen
      sessions={[{ id: "old", startedAtMs: 1, durationMinutes: 5, pieceCount: 1, status: "Completed" }]}
      onStart={vi.fn()}
      onAbout={vi.fn()}
      onOpenSession={onOpenSession}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /open session/i }));
  expect(onOpenSession).toHaveBeenCalledWith("old");
});
