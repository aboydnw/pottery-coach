import { describe, expect, it } from "vitest";
import { createSessionState, transition, type SessionState } from "./AppSessionOrchestrator";

describe("session lifecycle", () => {
  it("follows the explicit happy path and supports review deletion", () => {
    let state = createSessionState();
    for (const event of ["ACCEPT_NOTICE", "CAMERA_READY", "CALIBRATED", "AUDIO_DECIDED", "GOAL_SET", "START_LIVE", "END_SESSION"] as const)
      state = transition(state, { type: event });
    expect(state.step).toBe("review");
    expect(transition(state, { type: "DELETE_SESSION" }).step).toBe("notice");
  });

  it("rejects invalid transitions and audits them", () => {
    const state = transition(createSessionState(), { type: "START_LIVE" });
    expect(state.step).toBe("notice");
    expect(state.audit.at(-1)?.accepted).toBe(false);
  });

  it("degrades independently when calibration, voice, and storage fail", () => {
    let state: SessionState = { ...createSessionState(), step: "live" };
    state = transition(state, { type: "CALIBRATION_LOST" });
    state = transition(state, { type: "VOICE_DISCONNECTED" });
    state = transition(state, { type: "STORAGE_FAILED" });
    expect(state.modes).toEqual({ numeric: false, voice: false, storage: false, paused: false });
    expect(state.step).toBe("live");
  });

  it("pauses on background and resumes without making stale data fresh", () => {
    let state: SessionState = { ...createSessionState(), step: "live" };
    state = transition(state, { type: "BACKGROUND" });
    expect(state.modes.paused).toBe(true);
    state = transition(state, { type: "RESUME" });
    expect(state.modes.paused).toBe(false);
    expect(state.requiresFreshEvidence).toBe(true);
  });
});
