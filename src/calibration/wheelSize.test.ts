import { expect, it } from "vitest";
import { formatDiameter, inchesToMm, loadRememberedDiameterMm, parseDiameterMm, rememberDiameterMm } from "./wheelSize";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
    clear: () => values.clear(),
    key: () => null,
    get length() {
      return values.size;
    },
  };
}

it("converts inches and centimetres to millimetres", () => {
  expect(parseDiameterMm("14", "in")).toBeCloseTo(355.6);
  expect(parseDiameterMm("35,5", "cm")).toBeCloseTo(355);
  expect(inchesToMm(12)).toBeCloseTo(304.8);
});

it("rejects sizes that cannot be a wheel head or bat", () => {
  expect(parseDiameterMm("4", "in")).toBeNull();
  expect(parseDiameterMm("90", "cm")).toBeNull();
  expect(parseDiameterMm("wide", "in")).toBeNull();
});

it("formats a diameter for display", () => {
  expect(formatDiameter(355.6, "in")).toBe("14 in");
  expect(formatDiameter(355.6, "cm")).toBe("35.6 cm");
});

it("remembers a valid size per device and ignores corrupt values", () => {
  const storage = memoryStorage();
  expect(loadRememberedDiameterMm(storage)).toBeNull();
  rememberDiameterMm(330.2, storage);
  expect(loadRememberedDiameterMm(storage)).toBeCloseTo(330.2);
  storage.setItem("pottery-coach-wheel-head-mm", "9999");
  expect(loadRememberedDiameterMm(storage)).toBeNull();
});
