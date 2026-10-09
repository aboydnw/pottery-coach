import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it } from "vitest";

import { GoalProgress } from "./GoalProgress";
import type { ProfileComparison } from "./types";

afterEach(cleanup);

function comparison(confidence = 0.9): ProfileComparison {
  const component = { score: confidence, reasons: [] };
  return { id: "p", timestampMs: 1, readingId: "r", targetId: "t", meanAbsoluteRadiusErrorMm: 4, normalizedSilhouetteIoU: 0.9,
    regions: [
      { region: "base", signedMedianRadiusErrorMm: 2, meanAbsoluteRadiusErrorMm: 2, coverage: 1, confidence },
      { region: "lower-body", signedMedianRadiusErrorMm: 6, meanAbsoluteRadiusErrorMm: 6, coverage: 1, confidence },
      { region: "upper-body", signedMedianRadiusErrorMm: -3, meanAbsoluteRadiusErrorMm: 3, coverage: 1, confidence },
      { region: "rim", signedMedianRadiusErrorMm: 1, meanAbsoluteRadiusErrorMm: 1, coverage: 1, confidence },
    ], confidence: { overall: confidence, calibration: component, segmentation: component, occlusion: component, temporalStability: component, freshnessMs: 0, estimatedErrorMm95: 5 } };
}

it("reports the largest eligible regional deviation with direction", () => {
  render(<GoalProgress comparison={comparison()} heightProgress={0.81} />);
  expect(screen.getByText(/lower body is about 6 mm too wide/i)).toBeInTheDocument();
  expect(screen.getByText(/80% height milestone/i)).toBeInTheDocument();
});

it("suppresses regional claims at low confidence", () => {
  render(<GoalProgress comparison={comparison(0.5)} heightProgress={0.9} />);
  expect(screen.getByText(/not reliable enough/i)).toBeInTheDocument();
  expect(screen.queryByText(/too wide/i)).not.toBeInTheDocument();
});
