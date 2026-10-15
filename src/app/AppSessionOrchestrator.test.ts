import { describe, expect, it } from "vitest";
import { createSessionState, restoreSessionShell, transition, type SessionState } from "./AppSessionOrchestrator";

describe("session lifecycle", () => {
  it("goes from welcome straight to a live session, then review and deletion", () => {
    let state = createSessionState();
    state = transition(state, { type: "START_SESSION" });
    expect(state.step).toBe("live");
    state = transition(state, { type: "END_SESSION" });
    expect(state.step).toBe("review");
    expect(transition(state, { type: "DELETE_SESSION" }).step).toBe("notice");
  });

  it("rejects invalid transitions and audits them", () => {
    const state = transition(createSessionState(), { type: "END_SESSION" });
    expect(state.step).toBe("notice");
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
    state = transition({ ...state, step: "notice" }, { type: "START_SESSION" });
    expect(state.cameraError).toBeNull();
  });

  it("restores only degraded modes after a reload, never a live session", () => {
    const restored = restoreSessionShell(
      JSON.stringify({ step: "live", modes: { voice: false }, secret: "must-ignore" }),
    );
    expect(restored.step).toBe("notice");
    expect(restored.modes.voice).toBe(false);
    expect(JSON.stringify(restored)).not.toContain("must-ignore");
  });

  it("keeps the audit trail bounded", () => {
    let state = createSessionState();
    for (let index = 0; index < 250; index += 1) state = transition(state, { type: "END_SESSION" });
    expect(state.audit).toHaveLength(100);
  });
});
