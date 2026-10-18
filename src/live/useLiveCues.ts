import { useEffect, useRef } from "react";
import { CueArbiter } from "../coaching/CueArbiter";
import { evaluatePolicies } from "../coaching/evaluatePolicies";
import { CueObserver, cueLine, LIVE_CUE_POLICIES, type CueInputs } from "../coaching/liveCues";

const TICK_MS = 500;

type Options = Omit<CueInputs, "nowMs"> & {
  /** Cues belong to a piece; a new piece starts fresh (milestones can be said again). */
  pieceId: string | null;
  paused: boolean;
  /** Someone is talking, so the cue waits. */
  isBusy(): boolean;
  /** Delivers a cue that passed every check. */
  onCue(policyId: string, text: string): void;
};

/**
 * Watches the live measurements twice a second and lets through at most one cue at a time: only
 * once an issue has held for a while, never while anyone is talking or hands are on the pot, and
 * never more often than the cooldowns allow.
 */
export function useLiveCues(options: Options): void {
  const latest = useRef(options);
  const stateRef = useRef<{ pieceId: string; observer: CueObserver; arbiter: CueArbiter } | null>(null);

  useEffect(() => {
    latest.current = options;
  });

  useEffect(() => {
    const tick = () => {
      const { pieceId, paused, isBusy, onCue, ...inputs } = latest.current;
      if (!pieceId) return;
      if (stateRef.current?.pieceId !== pieceId) {
        stateRef.current = { pieceId, observer: new CueObserver(pieceId), arbiter: new CueArbiter(() => Date.now()) };
      }
      const { observer, arbiter } = stateRef.current;
      const nowMs = Date.now();
      const observations = observer.observe({ ...inputs, nowMs });
      if (paused) return;
      const candidates = observations.flatMap((observation) => evaluatePolicies(observation, LIVE_CUE_POLICIES, nowMs));
      if (!candidates.length) return;
      const { speak } = arbiter.consider(candidates, {
        userSpeaking: isBusy(),
        activeShaping: inputs.handsLikely,
        occluded: false,
      });
      if (!speak) return;
      arbiter.markSpoken(speak);
      onCue(speak.policyId, cueLine(speak));
    };
    const interval = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(interval);
  }, []);
}
