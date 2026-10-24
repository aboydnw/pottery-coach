import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SessionFlow } from "./SessionFlow";

vi.mock("../live/LiveSession", () => ({ LiveSession: () => <div>live session</div> }));
beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});
afterEach(cleanup);

it("waits for one deliberate tap, then goes straight to the live session", () => {
  render(<SessionFlow />);
  expect(screen.getByRole("heading", { name: /ready at the wheel/i })).toBeInTheDocument();
  expect(screen.queryByText("live session")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /start session/i }));
  expect(screen.getByText("live session")).toBeInTheDocument();
  expect(window.location.pathname).toBe("/session/live");
});

it("opens the explanatory About page and returns home", () => {
  render(<SessionFlow />);
  fireEvent.click(screen.getByRole("button", { name: "About" }));
  expect(screen.getByRole("heading", { name: /hands-free second set of eyes/i })).toBeInTheDocument();
  expect(window.location.pathname).toBe("/about");
  fireEvent.click(screen.getByRole("button", { name: /go home/i }));
  expect(screen.getByRole("heading", { name: /ready at the wheel/i })).toBeInTheDocument();
  expect(window.location.pathname).toBe("/");
});
