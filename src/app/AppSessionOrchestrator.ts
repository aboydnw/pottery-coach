export type SessionStep = "notice" | "camera" | "calibration" | "audio-consent" | "goal" | "live" | "review";
export type SessionEvent = { type: "ACCEPT_NOTICE" | "CAMERA_READY" | "CALIBRATED" | "AUDIO_DECIDED" | "GOAL_SET" | "START_LIVE" | "END_SESSION" | "DELETE_SESSION" | "CALIBRATION_LOST" | "VOICE_DISCONNECTED" | "STORAGE_FAILED" | "BACKGROUND" | "RESUME" };
export type SessionState = { step: SessionStep; modes: { numeric: boolean; voice: boolean; storage: boolean; paused: boolean };
  requiresFreshEvidence: boolean; audit: Array<{ event: SessionEvent["type"]; accepted: boolean }> };

export function createSessionState(): SessionState {
  return { step: "notice", modes: { numeric: true, voice: true, storage: true, paused: false }, requiresFreshEvidence: false, audit: [] };
}

const path: Partial<Record<SessionStep, Partial<Record<SessionEvent["type"], SessionStep>>>> = {
  notice: { ACCEPT_NOTICE: "camera" }, camera: { CAMERA_READY: "calibration" },
  calibration: { CALIBRATED: "audio-consent" }, "audio-consent": { AUDIO_DECIDED: "goal" },
  goal: { GOAL_SET: "live", START_LIVE: "live" }, live: { END_SESSION: "review" }, review: { DELETE_SESSION: "notice" },
};

export function transition(state: SessionState, event: SessionEvent): SessionState {
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

function update(state: SessionState, event: SessionEvent, patch: Partial<SessionState>): SessionState {
  return { ...state, ...patch, audit: [...state.audit, { event: event.type, accepted: true }] };
}
