import { expect, it } from "vitest";
import { reduceSessionState, type SessionSnapshot } from "./SessionState";

it("tracks explicit pause/resume and makes end terminal", () => {
  let state: SessionSnapshot = { status: "setup", startedAtMs: null, endedAtMs: null, pauseCount: 0 };
  state = reduceSessionState(state, { type: "start", timestampMs: 10 });
  state = reduceSessionState(state, { type: "pause" }); state = reduceSessionState(state, { type: "resume" });
  state = reduceSessionState(state, { type: "end", timestampMs: 20 });
  expect(state).toEqual({ status: "ended", startedAtMs: 10, endedAtMs: 20, pauseCount: 1 });
  expect(reduceSessionState(state, { type: "start", timestampMs: 30 })).toBe(state);
});
