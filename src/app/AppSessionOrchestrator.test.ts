import { describe, expect, it } from "vitest";
import { createSessionState, restoreSessionShell, transition, type SessionState } from "./AppSessionOrchestrator";

describe("session lifecycle", () => {
  it("goes from home to a live session and then its review", () => {
    let state = createSessionState();
    state = transition(state, { type: "START_SESSION" });
    expect(state.step).toBe("live");
    state = transition(state, { type: "END_SESSION", sessionId: "session-1" });
    expect(state.step).toBe("review");
    expect(state.reviewSessionId).toBe("session-1");
  });

  it("starts a fresh session from review without treating it as deletion", () => {
    const review = transition(createSessionState(), { type: "OPEN_REVIEW", sessionId: "kept-session" });
    const live = transition(review, { type: "START_NEW_SESSION" });

    expect(live.step).toBe("live");
    expect(live.reviewSessionId).toBeNull();
    expect(live.audit.at(-1)).toEqual({ event: "START_NEW_SESSION", accepted: true });
  });

  it("navigates between home, about, and a selected review", () => {
    let state = transition(createSessionState(), { type: "SHOW_ABOUT" });
    expect(state.step).toBe("about");
    state = transition(state, { type: "GO_HOME" });
    expect(state.step).toBe("home");
    state = transition(state, { type: "OPEN_REVIEW", sessionId: "past-session" });
    expect(state).toMatchObject({ step: "review", reviewSessionId: "past-session" });
    state = transition(state, { type: "GO_HOME" });
    expect(state).toMatchObject({ step: "home", reviewSessionId: null });
  });

  it("rejects invalid transitions and audits them", () => {
    const state = transition(createSessionState(), { type: "END_SESSION" });
    expect(state.step).toBe("home");
    expect(state.audit.at(-1)?.accepted).toBe(false);
  });

  it("degrades voice and storage independently while staying live", () => {
    let state: SessionState = { ...createSessionState(), step: "live" };
    state = transition(state, { type: "VOICE_DISCONNECTED" });
    state = transition(state, { type: "STORAGE_FAILED" });
    expect(state.modes).toEqual({ voice: false, storage: false, paused: false });
    expect(state.step).toBe("live");
  });

  it("records a denied camera and clears it when a new session starts", () => {
    let state = transition({ ...createSessionState(), step: "live" }, { type: "CAMERA_DENIED" });
    expect(state.cameraError).toBe("permission-denied");
    state = transition({ ...state, step: "home" }, { type: "START_SESSION" });
    expect(state.cameraError).toBeNull();
  });

  it("restores only degraded modes after a reload, never a live session", () => {
    const restored = restoreSessionShell(
      JSON.stringify({ step: "live", modes: { voice: false }, secret: "must-ignore" }),
    );
    expect(restored.step).toBe("home");
    expect(restored.modes.voice).toBe(false);
    expect(JSON.stringify(restored)).not.toContain("must-ignore");
  });

  it("keeps the audit trail bounded", () => {
    let state = createSessionState();
    for (let index = 0; index < 250; index += 1) state = transition(state, { type: "END_SESSION" });
    expect(state.audit).toHaveLength(100);
  });
});
