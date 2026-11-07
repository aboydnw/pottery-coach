import { expect, it } from "vitest";
import { exportDataset } from "../../src/vision/dataset/export";
import { createDatasetExample } from "../../src/vision/dataset/example";
import { validateDatasetSplit, validateReviewedDataset } from "./dataset";

const example = {
  schemaVersion: "clay-dataset-v1",
  id: "one",
  sessionGroupId: "session-a",
  frameDataUrl: "data:image/webp;base64,AAAA",
  width: 2,
  height: 1,
  automaticMask: { encoding: "value-runs-v1", runs: [1, 2] },
  correctedMask: { encoding: "value-runs-v1", runs: [1, 1, 0, 1] },
  verdict: "corrected",
  segmentationVersion: "background-v1",
  rights: "tester-owned",
};
function dataset(examples: unknown[] = [example], count = examples.length) {
  return [{ schemaVersion: "clay-dataset-v1", kind: "manifest", exampleCount: count }, ...examples]
    .map((row) => JSON.stringify(row))
    .join("\n");
}

it("accepts reviewed annotations without asserting physical accuracy", () => {
  expect(validateReviewedDataset(dataset())).toEqual({
    exampleCount: 1,
    sessionGroups: ["session-a"],
    exampleIds: ["one"],
  });
});

it("accepts actual app exports with a reviewed no-clay verdict", async () => {
  const capture = createDatasetExample({
    sessionGroupId: "a",
    frameDataUrl: "data:image/webp;base64,AAAA",
    width: 1,
    height: 1,
    automaticMask: new Uint8Array([1]),
    correctedMask: null,
    verdict: "no-clay",
    calibrationId: "cal-1",
    wheelDiameterMm: null,
    calibrationGeometry: null,
    segmentationVersion: "background-v1",
    conditions: ["empty-wheel"],
    rights: "tester-owned",
  });
  expect(validateReviewedDataset(await exportDataset([capture]).text()).exampleCount).toBe(1);
});

it.each([
  { sessionGroupId: " " },
  { id: "" },
  { verdict: "unusable" },
  { verdict: "pending" },
  { correctedMask: null },
  { correctedMask: { encoding: "value-runs-v1", runs: [0, 2] } },
  { verdict: "no-clay" },
  { rights: "unknown" },
  { segmentationVersion: "" },
  { frameDataUrl: "https://example.com/image.jpg" },
  { width: 0 },
  { height: 1.5 },
  { automaticMask: { encoding: "other", runs: [1, 2] } },
  { automaticMask: { encoding: "value-runs-v1", runs: [1, 1] } },
  { automaticMask: { encoding: "value-runs-v1", runs: [1, 3] } },
  { automaticMask: { encoding: "value-runs-v1", runs: [1, -2] } },
  { automaticMask: { encoding: "value-runs-v1", runs: [2, 2] } },
  { automaticMask: { encoding: "value-runs-v1", runs: [1] } },
])("rejects invalid or unreviewed annotations: %j", (change) => {
  expect(() => validateReviewedDataset(dataset([{ ...example, ...change }]))).toThrow();
});

it("rejects empty, mismatched-count, duplicate-ID and malformed exports", () => {
  for (const text of [
    dataset([]),
    dataset([example], 2),
    dataset([example, example]),
    "null",
    "{}",
    dataset().replace('"exampleCount":1', '"exampleCount":"1"'),
  ]) {
    expect(() => validateReviewedDataset(text)).toThrow();
  }
});

it("requires disjoint session groups and example IDs, not merely different filenames", () => {
  const training = validateReviewedDataset(dataset());
  const evaluate = (id: string, sessionGroupId: string) =>
    validateReviewedDataset(dataset([{ ...example, id, sessionGroupId }]));
  expect(() => validateDatasetSplit(training, evaluate("two", "session-a"))).toThrow();
  expect(() => validateDatasetSplit(training, evaluate("one", "session-b"))).toThrow();
  expect(() => validateDatasetSplit(training, evaluate("two", "session-b"))).not.toThrow();
});
