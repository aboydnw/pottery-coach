import { expect, it } from "vitest";
import { formatCueFacts } from "./formatCueFacts";

it("copies immutable evidence facts and rejects evidence-free phrasing", () => {
  const input = formatCueFacts({ policyId: "dimensions", createdAtMs: 1, expiresAtMs: 2, priority: 2,
    evidenceIds: ["r1"], facts: { heightMm: 120, uncertaintyMm: 3 } });
  expect(input).toMatchObject({ policyId: "dimensions", evidenceIds: ["r1"], facts: { heightMm: 120, uncertaintyMm: 3 } });
  expect(Object.isFrozen(input.facts)).toBe(true);
  expect(() => formatCueFacts({ policyId: "x", createdAtMs: 1, expiresAtMs: 2, priority: 2, evidenceIds: [], facts: {} })).toThrow(/evidence/i);
});
