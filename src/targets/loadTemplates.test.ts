import { expect, it } from "vitest";

import { loadTemplates } from "./loadTemplates";

it("loads two stable sorted reviewed templates", () => {
  const templates = loadTemplates();
  expect(templates.map((template) => template.id)).toEqual(["straight-cylinder-v1", "tapered-cylinder-v1"]);
  expect(templates.every((template) => template.normalizedRadiusByHeight.length === 101)).toBe(true);
});
