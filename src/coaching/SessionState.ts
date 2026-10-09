export type SessionSnapshot = { status: "setup" | "live" | "paused" | "ended"; startedAtMs: number | null; endedAtMs: number | null; pauseCount: number };
export type SessionEvent = { type: "start"; timestampMs: number } | { type: "pause" } | { type: "resume" } | { type: "end"; timestampMs: number };

export function reduceSessionState(state: SessionSnapshot, event: SessionEvent): SessionSnapshot {
  if (state.status === "ended") return state;
  if (event.type === "start" && state.status === "setup") return { ...state, status: "live", startedAtMs: event.timestampMs };
  if (event.type === "pause" && state.status === "live") return { ...state, status: "paused", pauseCount: state.pauseCount + 1 };
  if (event.type === "resume" && state.status === "paused") return { ...state, status: "live" };
  if (event.type === "end") return { ...state, status: "ended", endedAtMs: event.timestampMs };
  return state;
}
