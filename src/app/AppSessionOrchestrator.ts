export type SessionStep = "home" | "about" | "live" | "review";

export type SessionEventType =
  | "START_SESSION"
  | "START_NEW_SESSION"
  | "SHOW_ABOUT"
  | "GO_HOME"
  | "OPEN_REVIEW"
  | "CAMERA_DENIED"
  | "END_SESSION"
  | "DELETE_SESSION"
  | "VOICE_DISCONNECTED"
  | "STORAGE_FAILED"
  | "BACKGROUND"
  | "RESUME";

export type SessionEvent =
  | { type: "END_SESSION" | "OPEN_REVIEW"; sessionId?: string }
  | { type: Exclude<SessionEventType, "END_SESSION" | "OPEN_REVIEW"> };

export type SessionState = {
  step: SessionStep;
  modes: { voice: boolean; storage: boolean; paused: boolean };
  cameraError: "permission-denied" | null;
  reviewSessionId: string | null;
  audit: Array<{ event: SessionEventType; accepted: boolean }>;
};

const AUDIT_LIMIT = 100;

export function createSessionState(): SessionState {
  return {
    step: "home",
    modes: { voice: true, storage: true, paused: false },
    cameraError: null,
    reviewSessionId: null,
    audit: [],
  };
}

const path: Partial<Record<SessionStep, Partial<Record<SessionEventType, SessionStep>>>> = {
  home: { START_SESSION: "live", SHOW_ABOUT: "about", OPEN_REVIEW: "review" },
  about: { GO_HOME: "home", START_SESSION: "live" },
  live: { END_SESSION: "review" },
  review: { START_NEW_SESSION: "live", GO_HOME: "home" },
};

/**
 * The session's coarse lifecycle: welcome, one live session, then review. Setup (wheel size,
 * calibration, target, goal) lives in setup slots that can be filled at any time while live.
 */
export function transition(state: SessionState, event: SessionEvent): SessionState {
  if (event.type === "CAMERA_DENIED" && state.step === "live")
    return update(state, event, { cameraError: "permission-denied" });
  if (event.type === "VOICE_DISCONNECTED") return update(state, event, { modes: { ...state.modes, voice: false } });
  if (event.type === "STORAGE_FAILED") return update(state, event, { modes: { ...state.modes, storage: false } });
  if (event.type === "BACKGROUND" && state.step === "live")
    return update(state, event, { modes: { ...state.modes, paused: true } });
  if (event.type === "RESUME" && state.step === "live")
    return update(state, event, { modes: { ...state.modes, paused: false } });
  if (event.type === "OPEN_REVIEW" && state.step === "home" && event.sessionId)
    return update(state, event, { step: "review", reviewSessionId: event.sessionId });
  if (event.type === "END_SESSION" && state.step === "live" && event.sessionId)
    return update(state, event, { step: "review", reviewSessionId: event.sessionId });
  const next = path[state.step]?.[event.type];
  if (!next) return { ...state, audit: appendAudit(state.audit, event.type, false) };
  if (event.type === "START_SESSION" || event.type === "START_NEW_SESSION")
    return update(state, event, { step: next, cameraError: null, reviewSessionId: null });
  if (event.type === "GO_HOME") return update(state, event, { step: next, reviewSessionId: null });
  return update(state, event, { step: next });
}

/** After a reload the camera and microphone need a fresh tap, so only degraded modes survive. */
export function restoreSessionShell(value: string | null): SessionState {
  const base = createSessionState();
  if (!value) return base;
  try {
    const parsed = JSON.parse(value) as { modes?: { voice?: unknown; storage?: unknown } };
    return {
      ...base,
      modes: { ...base.modes, voice: parsed.modes?.voice !== false, storage: parsed.modes?.storage !== false },
    };
  } catch {
    return base;
  }
}

export function serializeSessionShell(state: SessionState) {
  return JSON.stringify({ step: state.step, modes: { voice: state.modes.voice, storage: state.modes.storage } });
}

function update(state: SessionState, event: SessionEvent, patch: Partial<SessionState>): SessionState {
  return { ...state, ...patch, audit: appendAudit(state.audit, event.type, true) };
}

function appendAudit(audit: SessionState["audit"], event: SessionEventType, accepted: boolean): SessionState["audit"] {
  return [...audit, { event, accepted }].slice(-AUDIT_LIMIT);
}
