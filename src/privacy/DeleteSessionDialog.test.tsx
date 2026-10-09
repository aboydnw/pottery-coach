import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { DeleteSessionDialog } from "./DeleteSessionDialog";

it("requires confirmation and offers a receipt download without claiming provider deletion", async () => {
  render(<DeleteSessionDialog onDelete={async () => ({ sessionId: "s", requestedAtMs: 1, completedAtMs: 2,
    stores: [{ name: "provider-exception", status: "provider-exception" }] })} />);
  fireEvent.click(screen.getByRole("button", { name: /^delete session$/i }));
  expect(screen.getByText(/stored by pottery coach/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /confirm deletion/i }));
  expect(await screen.findByText(/provider-exception: provider-exception/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /download deletion receipt/i })).toBeInTheDocument();
});
