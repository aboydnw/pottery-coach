import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { SessionFlow } from "./SessionFlow";

vi.mock("../live/LiveSession", () => ({ LiveSession: () => <div>live session</div> }));
beforeEach(() => sessionStorage.clear());

it("waits for one deliberate tap, then goes straight to the live session", () => {
  render(<SessionFlow />);
  expect(screen.getByRole("heading", { name: /ready when your hands are clean/i })).toBeInTheDocument();
  expect(screen.queryByText("live session")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /start session/i }));
  expect(screen.getByText("live session")).toBeInTheDocument();
  expect(window.location.pathname).toBe("/session/live");
});
