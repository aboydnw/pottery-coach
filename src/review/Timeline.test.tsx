import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Timeline } from "./Timeline";

it("pages timelines over 500 events without discarding later evidence", () => {
  const events = Array.from({ length: 501 }, (_, index) => ({ id: `e${index}`, sessionId: "s",
    timestampMs: index, type: "cue", evidenceIds: [], payload: {} }));
  render(<Timeline events={events} />);
  expect(screen.getByText(/1–100 of 501/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /last page/i }));
  expect(screen.getByText(/501–501 of 501/)).toBeInTheDocument();
});
