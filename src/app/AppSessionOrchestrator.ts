export type SessionStep = "notice" | "camera" | "calibration" | "audio-consent" | "goal" | "live" | "review";
export type SessionEvent = { type: "ACCEPT_NOTICE" | "CAMERA_READY" | "CAMERA_DENIED" | "RETRY_CAMERA" | "CALIBRATED" | "AUDIO_DECIDED" | "GOAL_SET" | "START_LIVE" | "END_SESSION" | "DELETE_SESSION" | "CALIBRATION_LOST" | "VOICE_DISCONNECTED" | "STORAGE_FAILED" | "BACKGROUND" | "RESUME" };
export type SessionState = { step: SessionStep; modes: { numeric: boolean; voice: boolean; storage: boolean; paused: boolean };
  requiresFreshEvidence: boolean; cameraError: "permission-denied" | null;
  audit: Array<{ event: SessionEvent["type"]; accepted: boolean }> };

export function createSessionState(): SessionState {
  return { step: "notice", modes: { numeric: true, voice: true, storage: true, paused: false }, requiresFreshEvidence: false, cameraError: null, audit: [] };
}

const path: Partial<Record<SessionStep, Partial<Record<SessionEvent["type"], SessionStep>>>> = {
  notice: { ACCEPT_NOTICE: "camera" }, camera: { CAMERA_READY: "calibration" },
  calibration: { CALIBRATED: "audio-consent" }, "audio-consent": { AUDIO_DECIDED: "goal" },
  goal: { GOAL_SET: "live", START_LIVE: "live" }, live: { END_SESSION: "review" }, review: { DELETE_SESSION: "notice" },
};

export function transition(state: SessionState, event: SessionEvent): SessionState {
  if (event.type === "CAMERA_DENIED" && state.step === "camera") return update(state, event, { cameraError: "permission-denied" });
  if (event.type === "RETRY_CAMERA" && state.step === "camera") return update(state, event, { cameraError: null });
  if (event.type === "CALIBRATION_LOST" && state.step === "live") return update(state, event, { modes: { ...state.modes, numeric: false }, requiresFreshEvidence: true });
  if (event.type === "VOICE_DISCONNECTED" && state.step === "live") return update(state, event, { modes: { ...state.modes, voice: false } });
  if (event.type === "STORAGE_FAILED") return update(state, event, { modes: { ...state.modes, storage: false } });
  if (event.type === "BACKGROUND" && state.step === "live") return update(state, event, { modes: { ...state.modes, paused: true }, requiresFreshEvidence: true });
  if (event.type === "RESUME" && state.step === "live") return update(state, event, { modes: { ...state.modes, paused: false }, requiresFreshEvidence: true });
  const next = path[state.step]?.[event.type];
  if (!next) return { ...state, audit: [...state.audit, { event: event.type, accepted: false }] };
  if (event.type === "DELETE_SESSION") return { ...createSessionState(), audit: [...state.audit, { event: event.type, accepted: true }] };
  return update(state, event, { step: next });
}

const resumableSteps = new Set<SessionStep>(["camera", "calibration", "audio-consent", "goal", "live"]);
export function restoreSessionShell(value: string | null): SessionState {
  const base = createSessionState();
  if (!value) return base;
  try {
    const parsed = JSON.parse(value) as { step?: unknown; modes?: { voice?: unknown; storage?: unknown } };
    if (typeof parsed.step !== "string" || !resumableSteps.has(parsed.step as SessionStep)) return base;
    return { ...base, step: "camera", requiresFreshEvidence: parsed.step === "live",
      modes: { ...base.modes, voice: parsed.modes?.voice !== false, storage: parsed.modes?.storage !== false } };
  } catch { return base; }
}

export function serializeSessionShell(state: SessionState) {
  return JSON.stringify({ step: state.step, modes: { voice: state.modes.voice, storage: state.modes.storage } });
}

function update(state: SessionState, event: SessionEvent, patch: Partial<SessionState>): SessionState {
  return { ...state, ...patch, audit: [...state.audit, { event: event.type, accepted: true }] };
}
