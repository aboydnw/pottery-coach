import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";

import { CalibrationFlow } from "./CalibrationFlow";
import type { CalibrationResult } from "./types";

afterEach(cleanup);

function result(status: CalibrationResult["status"], reasons: string[] = []): CalibrationResult {
  return {
    id: "cal-1", createdAtMs: 1, status,
    homographyImageToMm: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    wheelBaseline: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    wheelCenterlineXmm: 50,
    roiImage: { x: 0, y: 0, width: 100, height: 100 },
    markerPlaneOffsetToleranceMm: 30,
    quality: { tagCount: 4, reprojectionErrorPx95: 1, scaleVariationFraction: 0.01, estimatedErrorMm95: 5, poseYawDeg: 0, posePitchDeg: 0, blurScore: 1, contrastScore: 1 },
    reasons, provenance: "automatic", boardRevision: "board-v1", supportedBoardRevision: "board-v1", roiClipped: false,
  };
}

it("accepts an automatic calibration after print-scale confirmation", () => {
  const onAccepted = vi.fn();
  render(<CalibrationFlow result={result("accepted")} onAccepted={onAccepted} />);
  fireEvent.click(screen.getByRole("checkbox", { name: /100 mm line/i }));
  fireEvent.click(screen.getByRole("button", { name: /use calibration/i }));
  expect(onAccepted).toHaveBeenCalledOnce();
});

it("requires baseline and vertical-axis review for manual assistance", () => {
  render(<CalibrationFlow result={result("manual-review")} onAccepted={vi.fn()} />);
  expect(screen.getByLabelText(/wheel baseline/i)).toBeRequired();
  expect(screen.getByLabelText(/vertical axis/i)).toBeRequired();
});

it("does not allow hard failures to be overridden", () => {
  render(<CalibrationFlow result={result("rejected", ["ROI_CLIPPED"])} onAccepted={vi.fn()} />);
  expect(screen.queryByRole("button", { name: /use calibration/i })).not.toBeInTheDocument();
  expect(screen.getByText(/ROI clipped/i)).toBeInTheDocument();
});

it("requires recalibration after board movement", () => {
  render(<CalibrationFlow result={result("accepted")} boardMoved onAccepted={vi.fn()} />);
  expect(screen.getByRole("status")).toHaveTextContent(/board moved/i);
  expect(screen.getByRole("button", { name: /recalibrate/i })).toBeInTheDocument();
});
