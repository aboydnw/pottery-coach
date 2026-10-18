import { expect, it } from "vitest";
import { MAX_POTTER_CONTEXT_LENGTH } from "../voice/instructions";
import { buildPotterContext } from "./potterContext";
import type { LastingNote } from "./types";

const note = (text: string): LastingNote => ({ id: text, text, createdAtMs: 0, updatedAtMs: 0, syncedAtMs: null });

it("lists lasting notes for the coach", () => {
  expect(buildPotterContext([note("Use inches"), note("Working on thinner walls")], [])).toBe(
    "- Use inches\n- Working on thinner walls",
  );
});

it("is empty for a new potter", () => {
  expect(buildPotterContext([], [])).toBe("");
});

it("never exceeds the size the server accepts", () => {
  const notes = Array.from({ length: 40 }, (_, index) => note(`${index} ${"x".repeat(95)}`));
  expect(buildPotterContext(notes, []).length).toBeLessThanOrEqual(MAX_POTTER_CONTEXT_LENGTH);
});
