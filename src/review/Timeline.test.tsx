import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Timeline } from "./Timeline";
afterEach(cleanup);

it("pages timelines over 500 events without discarding later evidence", () => {
  const events = Array.from({ length: 501 }, (_, index) => ({ id: `e${index}`, sessionId: "s",
    timestampMs: index, type: "cue", evidenceIds: [], payload: {} }));
  render(<Timeline events={events} />);
  expect(screen.getByText(/1–100 of 501/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /last page/i }));
  expect(screen.getByText(/501–501 of 501/)).toBeInTheDocument();
});

it("filters event types without changing the evidence records", () => {
  render(<Timeline events={[
    { id: "a", sessionId: "s", timestampMs: 1, type: "cue-spoken", evidenceIds: ["r1"], payload: {} },
    { id: "b", sessionId: "s", timestampMs: 2, type: "cue-suppressed", evidenceIds: ["r2"], payload: {} },
  ]} />);
  fireEvent.change(screen.getByLabelText(/event filter/i), { target: { value: "cue-suppressed" } });
  const eventList = within(screen.getByRole("list"));
  expect(eventList.getByText(/cue suppressed/i)).toBeVisible();
  expect(eventList.queryByText(/cue spoken/i)).not.toBeInTheDocument();
});
