/**
 * Demo shortcuts (deterministic calibration and readings) exist for local development and
 * automated tests. Production builds ignore `?mode=demo` unless built with VITE_ENABLE_DEMO=true.
 */
export const DEMO_AVAILABLE = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO === "true";

export function isDemoMode(search = window.location.search): boolean {
  return DEMO_AVAILABLE && new URLSearchParams(search).get("mode") === "demo";
}

export function isCameraOnlyMode(search = window.location.search): boolean {
  return new URLSearchParams(search).get("mode") === "camera-only";
}
