import { expect, it } from "vitest";
import { initialSlots, proposeSetup, readback, setupStatus, speakLength, confirmAll } from "./setupSlots";
import { SetupStore } from "./SetupStore";

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

it("starts live with a default target and asks for the rest", () => {
  expect(setupStatus(initialSlots())).toMatchObject({
    missing: ["wheel-head diameter", "goal height"],
    unconfirmed: [],
    nextRecommended: "wheel-head diameter",
  });
});

it("takes a compound answer, converts units in code, and reads it back before it counts", () => {
  const { slots, problems } = proposeSetup(initialSlots(), {
    wheelHeadDiameter: { value: 14, unit: "in" },
    targetId: "tapered-cylinder-v1",
    goal: { height: { value: 6, unit: "in" }, basis: "fired", shrinkagePercent: 12 },
  });
  expect(problems).toEqual([]);
  expect(slots.wheelHeadDiameterMm).toMatchObject({ value: 355.6, confirmed: false });
  expect(slots.goal?.value).toMatchObject({ basis: "fired", heightMm: 152.4, shrinkageFraction: 0.12 });
  expect(readback(slots)).toBe(
    "I have a 14 inches (that's 1-4) wheel head, a tapered cylinder and a goal height of 15.2 centimetres fired, with 12 percent shrinkage. Is that right?",
  );
  expect(setupStatus(slots).nextRecommended).toBe("confirm the read-back");
  expect(setupStatus(confirmAll(slots))).toMatchObject({ unconfirmed: [], missing: ["wheel-head edge check"] });
});

it("rejects implausible values instead of storing them", () => {
  const { slots, problems } = proposeSetup(initialSlots(), {
    wheelHeadDiameter: { value: 50, unit: "in" },
    goal: { height: { value: 150, unit: "cm" }, basis: "wet" },
  });
  expect(problems).toHaveLength(2);
  expect(slots.wheelHeadDiameterMm).toBeNull();
  expect(slots.goal).toBeNull();
});

it("insists on shrinkage for fired goals", () => {
  expect(
    proposeSetup(initialSlots(), { goal: { height: { value: 15, unit: "cm" }, basis: "fired" } }).problems,
  ).toHaveLength(1);
});

it("echoes easily misheard numbers digit by digit", () => {
  expect(speakLength(150, "cm")).toBe("15 centimetres (that's 1-5)");
  expect(speakLength(500, "cm")).toBe("50 centimetres (that's 5-0)");
  expect(speakLength(120, "cm")).toBe("12 centimetres");
});

it("remembers a confirmed setup so 'same as last time' needs one confirmation", () => {
  const storage = memoryStorage();
  const first = new SetupStore(storage);
  first.propose({
    wheelHeadDiameter: { value: 13, unit: "in" },
    goal: { height: { value: 12, unit: "cm" }, basis: "wet" },
  });
  first.confirm();

  const next = new SetupStore(storage);
  const loaded = next.loadLast();
  expect(loaded?.readback).toContain("13 inches");
  expect(next.getSnapshot().goal).toMatchObject({ source: "preset", confirmed: false });
  next.confirm();
  expect(next.status().unconfirmed).toEqual([]);
});

it("reports no preset when nothing was saved yet", () => {
  expect(new SetupStore(memoryStorage()).loadLast()).toBeNull();
});

it("needs a fresh edge check after the wheel size changes", () => {
  const store = new SetupStore(memoryStorage());
  store.apply({ wheelHeadDiameter: { value: 14, unit: "in" } });
  store.setCalibration("confirmed");
  store.propose({ wheelHeadDiameter: { value: 12, unit: "in" } });
  expect(store.getSnapshot().calibration).toBe("none");
});
