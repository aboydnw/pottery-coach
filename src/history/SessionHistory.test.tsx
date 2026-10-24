import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SessionHistory } from "./SessionHistory";

afterEach(cleanup);

it("shows a concise empty state", () => {
  render(<SessionHistory sessions={[]} onOpen={vi.fn()} />);
  expect(screen.getByText(/no past sessions yet/i)).toBeInTheDocument();
});

it("shows session metadata and opens the selected review", () => {
  const onOpen = vi.fn();
  render(
    <SessionHistory
      sessions={[
        {
          id: "session-1",
          startedAtMs: new Date("2026-10-24T12:00:00Z").getTime(),
          durationMinutes: 12,
          pieceCount: 2,
          status: "Completed",
        },
      ]}
      onOpen={onOpen}
    />,
  );

  expect(screen.getByText("12 min")).toBeInTheDocument();
  expect(screen.getByText("2 pieces")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /open session/i }));
  expect(onOpen).toHaveBeenCalledWith("session-1");
});
