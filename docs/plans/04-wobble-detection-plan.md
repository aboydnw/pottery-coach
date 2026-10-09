# Wobble Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline, task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Determine whether externally visible periodic oscillation can be measured specifically enough for V1, with proactive coaching disabled unless Gate 3 passes.

**Architecture:** The measurement worker publishes sparse temporal contours. A pure estimator subtracts static-scene motion, detrends shaping, estimates rotation period, robustly fits periodic terms, classifies signal patterns, and abstains aggressively.

**Tech Stack:** Existing TypeScript/Vitest stack; `fft.js ~4.0.4` only if audited bundle/performance beats a small autocorrelation/DFT implementation; seeded canvas fixture generator.

## Global Constraints

- Feature flag `wobbleProactive=false` by default.
- Require >=3 revolutions, >=70% valid samples, confidence >=.85, amplitude >3× noise, two agreeing windows.
- Say “visible oscillation” and “visually centered from this view,” never causal/internal/perfect centering.

---

### Task 1: Temporal contour ring buffer

**Files:** Create `src/wobble/types.ts`, `src/wobble/TemporalContourBuffer.ts`, `.test.ts`; modify measurement worker event.

**Interfaces:** Exact `TemporalContourSample`/`WobbleReading` from spec; `push(sample)`, `window(durationMs)`, `clear(reason)`. Max 120 seconds or 2,400 samples, whichever first.

- [ ] Write fake-clock tests for irregular timestamps, eviction, null bands, reset on calibration/visibility, and no raw mask retention.
- [ ] Run tests; expect module failure.
- [ ] Implement typed-array-backed ring buffer and contour downsampling at 5–9 bands.
- [ ] Run tests; expect bounded storage and stable chronological windows.
- [ ] Commit `feat: retain bounded temporal contour evidence`.

### Task 2: Camera motion and period estimation

**Files:** Create `src/wobble/cameraMotion.ts`, `.test.ts`, `src/wobble/period.ts`, `.test.ts`, fixtures.

**Interfaces:** `estimateCameraTransform(staticFeatures):{dxMm;dyMm;rotationRad;confidence;residualMm}`; `estimatePeriod(samples,{minMs:300,maxMs:3000}):PeriodEstimate|null`.

- [ ] Write seeded tests with known translation/rotation/outliers, sparse feature layouts, periods 0.4/0.7/1/1.5/2.5 s, dropped frames, brightness noise, and no periodic signal; require false period to return null.
- [ ] Run tests; expect failures.
- [ ] Implement fiducial/static-region robust affine fit with spatial-inlier checks; irregular-time resampling for analysis only; autocorrelation candidate confirmed by spectral peak.
- [ ] Run tests; expect period error <=5% for clean/fixture-supported noisy cases and camera confidence <.8 for degenerate layouts.
- [ ] Commit `feat: estimate camera motion and rotation period`.

### Task 3: Oscillation fitting, classification, suppression

**Files:** Create `src/wobble/fitOscillation.ts`, `.test.ts`, `src/wobble/classifyWobble.ts`, `.test.ts`, `src/wobble/WobbleService.ts`, `.test.ts`.

**Interfaces:** `fitOscillation(samples,period):FitResult`; `classifyWobble(window,fit,context):WobbleReading`; service `getLatest():WobbleReading`.

- [ ] Write tests for coherent center motion, rim-only motion, radius-only asymmetric rotation, camera shake, monotonic/cubic shaping, hand gaps, wheel-correlated vibration, noise-floor rejection, two-window persistence, and stale latest reading.
- [ ] Run tests; expect missing modules.
- [ ] Implement robust weighted `a*sin+b*cos+c+d*t` fit, band coherence/phase checks, suppression reason codes, immutable evidence frame IDs, and exact classifications.
- [ ] Run all wobble tests; expect negatives `unmeasurable`/specific non-centering classes and significant positives only after persistence.
- [ ] Commit `feat: classify visible rotational oscillation`.

### Task 4: Synthetic and physical Gate 3

**Files:** Create `benchmarks/wobble/generate.ts`, `run.ts`, `summarize.ts`, schemas/manifests, `docs/wobble-rig-protocol.md`; modify feature flags, benchmark results, risk register.

- [ ] Write summarizer tests whose fixture results fail each threshold independently: precision, false alerts/10 min, delay, 10 mm recall, camera suppression. Run first; expect missing summarizer.
- [ ] Implement seeded rendering at 30 fps across 0/2/5/10/20 mm, periods, camera motion, trends, occlusions, asymmetry, light/frame drops; output ground-truth JSONL.
- [ ] Run synthetic benchmark; expected: report actual results, not a gate pass until locked physical set is included.
- [ ] Build measured eccentric rig with dial indicator, record matched negatives and real hand-contact clips under consent, then run locked evaluation. Pass: >=90% significant precision, <=1 false proactive/10 min, <=3-revolution delay, >=90% recall at 10 mm, >=95% camera negatives suppressed.
- [ ] Browser acceptance: integrated worker remains >=10 Hz and rate loss <=20% on supported iPhone/Android for 20 minutes.
- [ ] Review checkpoint: independent benchmark reviewer checks labels/splits; pottery reviewer checks language. If pass, enable flag only for supported conditions; otherwise retain reactive-only/remove.
- [ ] Commit `test: record wobble viability decision`.

## Rollback/fallback

Disable proactive flag remotely/build-time without disabling dimensions. On gate failure, `getWobbleStatus` returns evidence only when measurable or explicit inability; no local urgent cue exists. If camera compensation is the failure, require visible fixed board during session before rerunning rather than attributing motion.

## Documentation requirements

Publish detection limit, tested rotation/lighting/occlusion bounds, confusion classes, rig metrology, raw result schema, language restrictions, and signed Gate 3 decision.
