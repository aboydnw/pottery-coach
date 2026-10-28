import { expect, it } from "vitest";

import { createDatasetSessionGroupId, isDatasetTestingMode } from "./testingMode";

it("only enables dataset collection through the explicit query flag", () => {
  expect(isDatasetTestingMode("?dataset=1")).toBe(true);
  expect(isDatasetTestingMode("?dataset=0")).toBe(false);
  expect(isDatasetTestingMode("")).toBe(false);
});

it("uses a timestamp-free random fallback for older browsers", () => {
  expect(createDatasetSessionGroupId({}, () => 0.25)).toBe("dataset-9-9");
});
