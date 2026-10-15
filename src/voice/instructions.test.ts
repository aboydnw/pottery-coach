import { expect, it } from "vitest";

import { COACH_INSTRUCTIONS } from "./instructions";

it("prohibits untooled quantitative answers and overclaims", () => {
  expect(COACH_INSTRUCTIONS).toContain("never state a numeric measurement without a tool result");
  expect(COACH_INSTRUCTIONS).toContain("visually centered from this view");
  expect(COACH_INSTRUCTIONS).not.toContain("perfectly centered");
});

it("keeps unit conversion and confirmation out of the model's hands", () => {
  expect(COACH_INSTRUCTIONS).toContain("never convert units yourself");
  expect(COACH_INSTRUCTIONS).toContain("call confirmSetup only after a clear yes");
});
