import { expect, it } from "vitest";
import { parseSpokenGoal } from "./parseSpokenGoal";

it("parses explicit wet and fired spoken boundaries without inventing shrinkage", () => {
  expect(parseSpokenGoal("Make it 300 millimeters high and 120 millimeters wide, wet", "cylinder"))
    .toMatchObject({ basis: "wet", desiredHeightMm: 300, desiredMaximumWidthMm: 120, shrinkageFraction: null });
  expect(parseSpokenGoal("300 mm high, fired, twelve percent shrinkage", "cylinder"))
    .toMatchObject({ basis: "fired", desiredHeightMm: 300, shrinkageFraction: 0.12 });
});

it("rejects ambiguous or unsupported spoken goals", () => {
  expect(() => parseSpokenGoal("make it medium sized", "cylinder")).toThrow(/height/i);
  expect(() => parseSpokenGoal("300 mm fired", "cylinder")).toThrow(/shrinkage/i);
});
