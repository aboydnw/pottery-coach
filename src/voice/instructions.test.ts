import { expect, it } from "vitest";

import { COACH_INSTRUCTIONS, COACH_INSTRUCTIONS_REVISION } from "./instructions";

it("prohibits untooled quantitative answers and overclaims", () => {
  expect(COACH_INSTRUCTIONS).toContain("never state a numeric measurement without a tool result");
  expect(COACH_INSTRUCTIONS).toContain("visually centered from this view");
  expect(COACH_INSTRUCTIONS).not.toContain("perfectly centered");
});

it("keeps unit conversion and confirmation out of the model's hands", () => {
  expect(COACH_INSTRUCTIONS).toContain("never convert units yourself");
  expect(COACH_INSTRUCTIONS).toContain("call confirmSetup only after a clear yes");
});

it("starts with the calibration foundation before inviting clay onto the wheel", () => {
  const setupCheck = COACH_INSTRUCTIONS.indexOf("calling getSetupStatus before speaking");
  const keepEmpty = COACH_INSTRUCTIONS.indexOf("Keep the wheel empty");
  const inviteClay = COACH_INSTRUCTIONS.indexOf("invite them to put their clay on");

  expect(setupCheck).toBeGreaterThan(-1);
  expect(keepEmpty).toBeGreaterThan(setupCheck);
  expect(inviteClay).toBeGreaterThan(keepEmpty);
  expect(COACH_INSTRUCTIONS).not.toContain("you've had a look at the empty wheel");
  expect(COACH_INSTRUCTIONS).toContain("printed calibration page");
  expect(COACH_INSTRUCTIONS).toContain("optional fallback");
  expect(COACH_INSTRUCTIONS_REVISION).toBe("marker-foundation-v3");
});
