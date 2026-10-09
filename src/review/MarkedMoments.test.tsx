import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { MarkedMoments } from "./MarkedMoments";

it("identifies local-only stills and missing stills by keyboard", () => {
  render(<MarkedMoments moments={[
    { id: "a", sessionId: "s", timestampMs: 1, label: "with still", stillBlobId: "blob", localOnly: true },
    { id: "b", sessionId: "s", timestampMs: 2, label: "without still", stillBlobId: null, localOnly: true },
  ]} />);
  fireEvent.keyDown(screen.getByRole("button", { name: "with still" }), { key: "Enter" });
  expect(screen.getByText(/saved on this device only/i)).toBeVisible();
  fireEvent.keyDown(screen.getByRole("button", { name: "without still" }), { key: "Enter" });
  expect(screen.getByText(/no still was saved/i)).toBeVisible();
});
