# Live Wheel Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline, task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace frozen-frame wheel calibration with a continuously updating overlay on the live camera and hide live captions by default behind a Settings toggle.

**Architecture:** A focused `useLiveWheelDetection` hook repeatedly captures the current video, maps detected candidates into intrinsic video coordinates, and owns candidate/stability state without retaining `ImageData`. A presentational `WheelLiveOverlay` renders current geometry and controls over the existing video; `LiveSession` connects it to the existing calibration math and shared voice/touch tool bridge.

**Tech Stack:** React 19, TypeScript 7, Vitest, Testing Library, Playwright, vanilla CSS.

## Global Constraints

- Never render or retain a captured still during wheel-head calibration.
- Voice and touch must start the same live detection flow.
- Settings and End Session remain reachable during calibration.
- Captions are hidden by default and can be enabled only from Settings.
- Preserve existing wheel calibration mathematics, storage schema, Cloudflare Access, and measurement pipeline.

---

### Task 1: Live wheel detection state

**Files:**
- Create: `src/calibration/useLiveWheelDetection.ts`
- Create: `src/calibration/useLiveWheelDetection.test.tsx`

**Interfaces:**
- Consumes: `captureFrame(video)`, `toGray`, `detectWheelHead`, `deriveWheelViewPose`, and an `HTMLVideoElement` ref.
- Produces: `useLiveWheelDetection({ videoRef, diameterMm, onStable }): { active, status, frameSize, candidates, candidateIndex, ellipse, adjusted, error, start, stop, retry, switchCandidate, adjustEllipse }`.

- [ ] **Step 1: Write failing lifecycle and freshness tests**

Test with fake timers and mocked capture/detection functions. Assert `start()` captures again on successive sampling intervals, the second detection replaces the first geometry, `stop()` prevents later captures, and calling `start()` again begins with no prior candidate.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm test -- src/calibration/useLiveWheelDetection.test.tsx`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement current-frame sampling and coordinate mapping**

Use a bounded interval of approximately 200 ms. Each tick calls `captureFrame(videoRef.current)`, immediately converts and detects, maps candidates to full-resolution coordinates, then drops the `ImageData`. Guard overlapping ticks and clear timers on stop/unmount.

- [ ] **Step 4: Add failing stability tests**

Assert that geometrically similar supported ellipses held for approximately one second call `onStable` once, while a moved ellipse resets the timer. Assert unsupported or low-confidence geometry never auto-confirms.

- [ ] **Step 5: Implement stability, candidate switching, retry, and manual suspension**

Compare normalized center, radii, and rotation deltas. Reset the stable-since timestamp when tolerances are exceeded. In manual mode, retain user-adjusted geometry and continue showing live video without replacing it from detector results.

- [ ] **Step 6: Run focused tests**

Run: `pnpm test -- src/calibration/useLiveWheelDetection.test.tsx`

Expected: PASS.

### Task 2: Live camera overlay component

**Files:**
- Create: `src/calibration/WheelLiveOverlay.tsx`
- Create: `src/calibration/WheelLiveOverlay.test.tsx`
- Delete: `src/calibration/WheelEllipseConfirm.tsx`
- Delete: `src/calibration/WheelEllipseConfirm.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: intrinsic `{ width, height }`, current `WheelEllipse`, diameter, status, mirror state, candidate bounds, and callbacks.
- Produces: an SVG overlay and compact controls with no canvas, bitmap, modal, or duplicated camera surface.

- [ ] **Step 1: Write failing overlay tests**

Assert the component renders an SVG ellipse using intrinsic video coordinates, contains no `canvas` or `img`, shows compact status, exposes applicable candidate buttons, and switches to sliders only after “Adjust manually.”

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm test -- src/calibration/WheelLiveOverlay.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the overlay and manual controls**

Reuse `deriveWheelViewPose` and `describeCalibrationReason` for guidance and supported-region geometry. Render the SVG as an absolute non-blocking layer over the camera, with controls in a compact bottom dock. Keep buttons at least 44 px and preserve focus states.

- [ ] **Step 4: Replace frozen-panel CSS with live-overlay CSS**

Remove `.wheel-still` and `.stage-panel` frozen-surface rules. Add `.wheel-live-overlay`, `.wheel-live-svg`, `.wheel-live-controls`, and compact caption rules that preserve top controls and camera visibility on narrow screens.

- [ ] **Step 5: Run focused tests**

Run: `pnpm test -- src/calibration/WheelLiveOverlay.test.tsx`

Expected: PASS.

### Task 3: Integrate shared voice/touch calibration and caption preference

**Files:**
- Modify: `src/live/LiveSession.tsx`
- Modify: `src/live/LiveSession.test.tsx`

**Interfaces:**
- Consumes: `useLiveWheelDetection` and `WheelLiveOverlay` from Tasks 1 and 2.
- Produces: shared `checkWheel`, `switchWheelEdges`, `adjustWheel`, `confirmWheel`, and `skipWheel` tool operations backed by current live geometry.

- [ ] **Step 1: Extend failing LiveSession tests**

Assert touch and `toolBridge.current.wheel.check()` both activate the live overlay; repeated timer ticks call frame capture repeatedly; no “Check the wheel outline” modal, canvas, or frozen still renders; captions are absent initially; and Settings exposes a “Show captions” checkbox that renders captions only after activation.

- [ ] **Step 2: Run LiveSession tests and verify failure**

Run: `pnpm test -- src/live/LiveSession.test.tsx`

Expected: FAIL on the new live-overlay and caption assertions.

- [ ] **Step 3: Replace `WheelCheckState` with the live detection hook**

Remove stored `ImageData`, one-shot `safeCapture`, and `WheelEllipseConfirm`. Make `checkWheel()` start/restart detection from an empty state and close Settings. Derive confirmation dimensions from the active video's `videoWidth` and `videoHeight`, and stop detection after successful confirmation, skipping, camera switching, or unmount.

- [ ] **Step 4: Add the caption Settings toggle**

Initialize `showCaptions` to `false`, render the checkbox in Settings, and mount `<Captions>` only when both voice is available and the toggle is enabled. Keep voice failures in the existing independent banner.

- [ ] **Step 5: Run LiveSession and voice tool tests**

Run: `pnpm test -- src/live/LiveSession.test.tsx src/voice/tools/registry.test.ts`

Expected: PASS.

### Task 4: Browser behavior and regression verification

**Files:**
- Modify: `tests/e2e/wheel-head.spec.ts`
- Modify: `tests/e2e/hands-free.spec.ts`
- Modify: `tests/e2e/fixtures/session-streams.ts` only if selectors need a shared helper.

**Interfaces:**
- Consumes: the public UI and mocked voice tool stream.
- Produces: browser-level proof of live overlay, shared voice/touch flow, and opt-in captions.

- [ ] **Step 1: Update failing browser expectations**

Replace frozen-modal assertions with `.wheel-live-overlay` visibility and absence of canvas/still imagery. Confirm the overlay remains while the underlying video keeps playing, manual controls work, voice can confirm, and captions appear only after enabling “Show captions” in Settings.

- [ ] **Step 2: Run focused E2E tests**

Run: `pnpm e2e --project=chromium-wheel-camera tests/e2e/wheel-head.spec.ts`

Expected: PASS after implementation; any failure must be resolved without weakening freshness assertions.

- [ ] **Step 3: Run the full verification suite**

Run: `pnpm lint && pnpm format:check && pnpm test && pnpm typecheck && pnpm build`

Run: `pnpm e2e --project=chromium --project=mobile-chromium --project=chromium-board-camera --project=chromium-wheel-camera`

Expected: all checks pass, with only documented intentional skips.

- [ ] **Step 4: Commit implementation**

Stage only the live calibration, captions, tests, spec, and plan changes. Commit with `feat: calibrate wheel on live camera feed`.

### Task 5: Pull request and CI monitoring

**Files:**
- No source changes unless CI reveals a reproducible issue.

**Interfaces:**
- Produces: a pushed branch and reviewed GitHub pull request targeting `main`.

- [ ] **Step 1: Push and open the pull request**

Push `feat/live-wheel-overlay`, then create a PR summarizing current-frame detection, the live overlay, opt-in captions, and verification evidence.

- [ ] **Step 2: Monitor checks to completion**

Use `gh pr checks --watch` or inspect individual failed runs. If a check fails, reproduce locally, add a focused regression test, fix, rerun relevant verification, push, and continue monitoring until checks pass or an external blocker is documented.
