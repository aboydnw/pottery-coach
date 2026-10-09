import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it } from "vitest";

import { ProfileOverlay } from "./ProfileOverlay";
import { loadTemplates } from "./loadTemplates";
import type { StableDimensionReading } from "../measurement/types";

afterEach(cleanup);

it("renders mirrored target and current paths with a non-color legend and gap breaks", () => {
  const component = { score: 0.9, reasons: [] };
  const reading: StableDimensionReading = {
    id: "r", timestampMs: 1, sourceFrameId: 1, calibrationId: "c", heightMm: 300,
    maximumWidthMm: 100, rimWidthMm: 90, baseWidthMm: 100, centerlineOffsetMm: 0, visibleAsymmetryMm: 0,
    profile: Array.from({ length: 64 }, (_, index) => ({ heightRatio: index / 63, radiusMm: index >= 20 && index <= 30 ? null : 50, confidence: 0.9 })),
    confidence: { overall: 0.9, calibration: component, segmentation: component, occlusion: component, temporalStability: component, freshnessMs: 0, estimatedErrorMm95: 5 },
    windowStartMs: 0, contributingFrameCount: 5, lastReliableTimestampMs: 1,
  };
  render(<ProfileOverlay target={loadTemplates()[0]!} reading={reading} mode="millimetres" />);
  expect(screen.getByText(/dashed.*target/i)).toBeInTheDocument();
  expect(screen.getByLabelText("Current measured profile").getAttribute("d")?.match(/M/g)?.length).toBeGreaterThan(2);
});
