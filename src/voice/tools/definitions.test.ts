import { expect, it } from "vitest";
import { REALTIME_TOOL_DEFINITIONS } from "./definitions";
import { COACH_INSTRUCTIONS } from "../instructions";

it("only refers to tools that exist in the coach instructions", () => {
  const names = new Set<string>(REALTIME_TOOL_DEFINITIONS.map((tool) => tool.name));
  const mentioned = [...COACH_INSTRUCTIONS.matchAll(/\b([a-z]+[A-Z][A-Za-z]+)\b/g)].map((match) => match[1]!);
  expect(mentioned.length).toBeGreaterThan(0);
  expect(mentioned.filter((name) => !names.has(name))).toEqual([]);
});
