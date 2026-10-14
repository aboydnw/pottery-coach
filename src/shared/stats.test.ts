import { expect, it } from "vitest";
import { groupBy, mean, median, percentile } from "./stats";

it("averages the middle pair for an even-length median", () => {
  expect(median([4, 1, 3, 2])).toBe(2.5);
  expect(median([3, 1, 2])).toBe(2);
  expect(median([])).toBe(0);
});

it("uses nearest-rank percentiles", () => {
  expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.95)).toBe(10);
  expect(percentile([1, 2, 3, 4], 0.5)).toBe(2);
  expect(percentile([], 0.5)).toBe(0);
});

it("returns zero for the mean of nothing", () => {
  expect(mean([])).toBe(0);
  expect(mean([1, 2, 3])).toBe(2);
});

it("groups items in first-seen key order", () => {
  expect([...groupBy(["a1", "b1", "a2"], (value) => value[0]).entries()]).toEqual([["a", ["a1", "a2"]], ["b", ["b1"]]]);
});
