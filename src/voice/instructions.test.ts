import { expect, it } from "vitest";

import { COACH_INSTRUCTIONS } from "./instructions";

it("prohibits untooled quantitative answers and overclaims", () => {
  expect(COACH_INSTRUCTIONS).toContain("Never state a numeric measurement without a tool result");
  expect(COACH_INSTRUCTIONS).toContain("visually centered from this view");
  expect(COACH_INSTRUCTIONS).not.toContain("perfectly centered");
});
