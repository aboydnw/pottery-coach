import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import type { DatasetFrameCapture } from "../workerProtocol";
import { ClayMaskEditor } from "./ClayMaskEditor";

afterEach(cleanup);

const capture: DatasetFrameCapture = {
  captureId: "capture-1",
  width: 2,
  height: 2,
  rgba: new Uint8ClampedArray(16),
  automaticMask: new Uint8Array([1, 0, 0, 0]),
  segmentationVersion: "background-v1",
  calibrationId: "cal-1",
  wheelDiameterMm: 350,
  calibrationGeometry: null,
};

it("saves an accepted automatic outline with selected conditions", () => {
  const onSave = vi.fn();
  render(<ClayMaskEditor capture={capture} onSave={onSave} onCancel={vi.fn()} />);

  fireEvent.click(screen.getByLabelText("Hands in frame"));
  fireEvent.click(screen.getByRole("button", { name: "Outline is correct" }));

  expect(onSave).toHaveBeenCalledWith({
    verdict: "correct",
    correctedMask: capture.automaticMask,
    conditions: ["hands"],
  });
});

it("can classify a frame as no clay without storing a corrected mask", () => {
  const onSave = vi.fn();
  render(<ClayMaskEditor capture={capture} onSave={onSave} onCancel={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "No clay visible" }));
  expect(onSave).toHaveBeenCalledWith({ verdict: "no-clay", correctedMask: null, conditions: [] });
});
