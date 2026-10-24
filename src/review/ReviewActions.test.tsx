import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ReviewActions } from "./ReviewActions";

afterEach(cleanup);

it("orders Start New Session before Delete Session and Go Home", () => {
  render(<ReviewActions onStartNew={vi.fn()} onDelete={vi.fn()} onHome={vi.fn()} />);
  expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
    "Start new session",
    "Delete session",
    "Go home",
  ]);
});

it("confirms deletion inline and can cancel without moving the action group", () => {
  render(<ReviewActions onStartNew={vi.fn()} onDelete={vi.fn()} onHome={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Delete session" }));
  expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Start new session" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByText(/cannot be undone/i)).not.toBeInTheDocument();
});

it("disables confirmation while deleting and reports completion", async () => {
  let finish!: (value: { sessionId: string; requestedAtMs: number; completedAtMs: number; stores: [] }) => void;
  const onDelete = vi.fn(
    () =>
      new Promise<{
        sessionId: string;
        requestedAtMs: number;
        completedAtMs: number;
        stores: [];
      }>((resolve) => {
        finish = resolve;
      }),
  );
  render(<ReviewActions onStartNew={vi.fn()} onDelete={onDelete} onHome={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Delete session" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm deletion" }));
  expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
  finish({ sessionId: "s", requestedAtMs: 1, completedAtMs: 2, stores: [] });
  await waitFor(() => expect(screen.getByText("Session deleted")).toBeInTheDocument());
  expect(screen.getByRole("button", { name: /download deletion receipt/i })).toBeInTheDocument();
});
