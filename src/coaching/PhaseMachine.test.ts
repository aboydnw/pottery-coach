import { expect, it } from "vitest";

import { PhaseMachine } from "./PhaseMachine";

it("uses user declarations, treats contradictions/expiry as uncertain, and keeps session end terminal", () => {
  const machine = new PhaseMachine(() => 1000);
  expect(machine.reduce({ type: "user-declared", phase: "centering" }).phase).toBe("centering");
  expect(machine.reduce({ type: "contradiction", reason: "shape-conflict" }).phase).toBe("uncertain");
  expect(machine.reduce({ type: "shape-corroboration", phase: "opening", confidence: 1 }).phase).toBe("uncertain");
  expect(machine.reduce({ type: "user-declared", phase: "opening" }).phase).toBe("opening");
  expect(machine.reduce({ type: "expired" }).phase).toBe("uncertain");
  expect(machine.reduce({ type: "session-ended" }).phase).toBe("session-ended");
  expect(machine.reduce({ type: "user-declared", phase: "shaping" }).phase).toBe("session-ended");
  expect(machine.auditLog()).toHaveLength(7);
});
