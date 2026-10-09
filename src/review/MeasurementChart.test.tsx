import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { MeasurementChart } from "./MeasurementChart";

it("exposes an accessible table and preserves null/low-confidence gaps", () => {
  render(<MeasurementChart readings={[
    { id: "a", sessionId: "s", timestampMs: 0, kind: "stable", values: { heightMm: 10 }, confidence: 0.9 },
    { id: "b", sessionId: "s", timestampMs: 500, kind: "stable", values: { heightMm: null }, confidence: 0.9 },
    { id: "c", sessionId: "s", timestampMs: 1_000, kind: "stable", values: { heightMm: 12 }, confidence: 0.9 },
  ]} />);
  expect(screen.getByRole("table", { name: /measurement data/i })).toHaveTextContent("Not measured reliably");
  expect(screen.getByRole("img").querySelectorAll("path")).toHaveLength(2);
  expect(screen.getByRole("table", { name: /measurement data/i })).toHaveTextContent("a");
});
