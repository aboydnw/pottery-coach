import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import type { DatasetFrameCapture } from "../workerProtocol";
import { DatasetWorkspace, type DatasetStore } from "./DatasetWorkspace";
import type { ClayDatasetExampleV1 } from "./types";

afterEach(cleanup);

const capture: DatasetFrameCapture = {
  captureId: "capture-1",
  width: 1,
  height: 1,
  rgba: new Uint8ClampedArray([20, 30, 40, 255]),
  automaticMask: new Uint8Array([1]),
  segmentationVersion: "background-v1",
  calibrationId: "cal-1",
  wheelDiameterMm: 350,
  calibrationGeometry: {
    wheelCenterImage: { x: 0.5, y: 0.8 },
    projectedVerticalImage: { x: 0, y: -1 },
    supportedRegionImage: { x: 0, y: 0, width: 1, height: 1 },
    wheelPlaneMmPerMajorPixel: 2,
    estimatedErrorMm95: 4,
  },
};

function store(): DatasetStore & { records: ClayDatasetExampleV1[] } {
  const records: ClayDatasetExampleV1[] = [];
  return {
    records,
    add: async (example) => void records.push(example),
    list: async () => [...records],
    count: async () => records.length,
    delete: async (id) =>
      records.splice(
        records.findIndex((record) => record.id === id),
        1,
      ).length > 0,
    clear: async () => void records.splice(0),
  };
}

it("captures, reviews, and stores one labeled frame only after the background is ready", async () => {
  const repository = store();
  const { rerender } = render(
    <DatasetWorkspace
      backgroundReady={false}
      captureFrame={vi.fn(async () => capture)}
      repository={repository}
      sessionGroupId="session-1"
      encodeFrame={() => "data:image/webp;base64,AAAA"}
    />,
  );
  expect((screen.getByRole("button", { name: "Capture training example" }) as HTMLButtonElement).disabled).toBe(true);

  rerender(
    <DatasetWorkspace
      backgroundReady
      captureFrame={vi.fn(async () => capture)}
      repository={repository}
      sessionGroupId="session-1"
      encodeFrame={() => "data:image/webp;base64,AAAA"}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Capture training example" }));
  await screen.findByRole("heading", { name: "Review the clay outline" });
  fireEvent.click(screen.getByRole("button", { name: "Outline is correct" }));

  await waitFor(() => expect(repository.records).toHaveLength(1));
  expect(repository.records[0]).toMatchObject({
    sessionGroupId: "session-1",
    verdict: "correct",
    wheelDiameterMm: 350,
    calibrationGeometry: { wheelCenterImage: { x: 0.5, y: 0.8 }, wheelPlaneMmPerMajorPixel: 2 },
  });
  expect(await screen.findByText(/1 reviewed example/)).toBeTruthy();
});
