# Robust Wheel-Head Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline, task-by-task.

**Goal:** Reliably detect and lock onto a fully visible wheel-head or bat rim in a cluttered live browser camera view, provide useful capture guidance, and preserve manually selected geometry through calibration and the voice-agent handoff.

**Architecture:** Replace filled-region ellipse discovery with a pure deterministic pipeline of frame-quality analysis, multi-threshold edge extraction, arc grouping, robust ellipse fitting, circumference verification, and domain scoring. Keep frame-to-frame association in `useLiveWheelDetection`; keep React responsible only for rendering and interaction. No new runtime dependency or learned model.

**Tech stack:** TypeScript 7, React 19, browser image buffers, Vitest, Testing Library, Playwright.

## Global constraints

- Require a complete rim for automatic acceptance.
- Keep all frame processing local to the device.
- Preserve the current 200 ms sampling cadence on the supported mobile browser profile.
- Do not add OpenCV.js, a learned model, or a remote image service.
- Keep pure detection code free of browser and React APIs for future iPhone reuse.
- Manual selection may identify geometry but may not bypass framing, pose, or complete-rim visibility checks.
- Use test-driven development for every behavior change.

---

## Task 1: Add realistic deterministic wheel-scene fixtures

**Files:**

- Create: `src/calibration/wheelEllipseFixtures.test.ts`
- Modify: `src/calibration/wheelEllipse.test.ts`

**Interfaces:**

- Test-only `renderWheelScene(options)` returns a `GrayImage` with configurable rim geometry and studio conditions.
- Test-only helpers render arcs, blur, deterministic noise, glare, shadows, nested rims, and distractors.

- [ ] **Step 1: Write the fixture renderer and failing behavior tests**

Add parameterized tests for light-on-dark and dark-on-light rims, a bat above a wheel head, low contrast, rotation, perspective aspect ratios, clay residue, glare, a face-like oval, apron graphics, a bucket, arms, and a large foreground blob. Assert parameter recovery for complete rims and no accepted candidate for scenes containing only distractors.

- [ ] **Step 2: Add complete-rim negative cases**

Render each missing quadrant, frame clipping, and long missing sectors. Assert that none can meet the automatic-support threshold even if an ellipse can be proposed.

- [ ] **Step 3: Run the focused tests and confirm the intended failures**

Run: `pnpm test -- src/calibration/wheelEllipse.test.ts src/calibration/wheelEllipseFixtures.test.ts`

- [ ] **Step 4: Commit test fixtures**

```bash
git add src/calibration/wheelEllipse.test.ts src/calibration/wheelEllipseFixtures.test.ts
git commit -m "test: cover realistic wheel rim detection"
```

## Task 2: Introduce capture-quality and edge-map primitives

**Files:**

- Create: `src/calibration/wheelEdges.ts`
- Create: `src/calibration/wheelEdges.test.ts`
- Modify: `src/calibration/wheelEllipse.ts`

**Interfaces:**

```ts
export type WheelCaptureReason = "BLURRY" | "LOW_CONTRAST" | "GLARE";
export type WheelCaptureQuality = {
  blurScore: number;
  contrastScore: number;
  glareFraction: number;
  reasons: WheelCaptureReason[];
};
export type WheelEdgePoint = {
  x: number;
  y: number;
  strength: number;
  normalX: number;
  normalY: number;
  polarity: -1 | 1;
};
export type WheelEdgeMap = {
  width: number;
  height: number;
  points: WheelEdgePoint[];
  quality: WheelCaptureQuality;
};
export function extractWheelEdges(image: GrayImage): WheelEdgeMap;
```

- [ ] **Step 1: Write failing quality tests**

Verify stable reason ordering for flat, blurred, and glare-heavy scenes. Verify acceptable scenes do not acquire a reason merely because the wheel is dark or light.

- [ ] **Step 2: Write failing edge tests**

Verify locally normalized, non-maximum-suppressed edges appear around both contrast polarities at multiple thresholds, preserve normal direction, and omit isolated texture and the top excluded region.

- [ ] **Step 3: Run the focused tests and confirm failure**

Run: `pnpm test -- src/calibration/wheelEdges.test.ts`

- [ ] **Step 4: Implement deterministic preprocessing and edge extraction**

Use fixed-size local contrast windows, central-difference gradients, gradient-direction non-maximum suppression, and deterministic high/medium/low thresholds derived from the search-region gradient distribution. Deduplicate identical points found at multiple thresholds.

- [ ] **Step 5: Run tests and commit**

Run: `pnpm test -- src/calibration/wheelEdges.test.ts src/calibration/wheelEllipse.test.ts`

```bash
git add src/calibration/wheelEdges.ts src/calibration/wheelEdges.test.ts src/calibration/wheelEllipse.ts
git commit -m "feat: extract wheel rim edge evidence"
```

## Task 3: Fit ellipse proposals from compatible arcs

**Files:**

- Create: `src/calibration/wheelArcs.ts`
- Create: `src/calibration/wheelArcs.test.ts`
- Modify: `src/calibration/wheelEllipse.ts`
- Modify: `src/calibration/wheelEllipse.test.ts`

**Interfaces:**

```ts
export type WheelArc = {
  points: WheelEdgePoint[];
  angularSpanRad: number;
  meanStrength: number;
  polarity: -1 | 0 | 1;
};
export function traceWheelArcs(edgeMap: WheelEdgeMap): WheelArc[];
export function fitWheelEllipseProposals(arcs: WheelArc[], frame: FrameSize): WheelEllipse[];
```

- [ ] **Step 1: Write failing arc-grouping tests**

Assert that smooth neighboring edge points form arcs, sharp corners split, short and nearly straight traces are rejected, and compatible endpoints join across a small gap.

- [ ] **Step 2: Write failing fit and refinement tests**

Assert deterministic recovery from a long arc and from several compatible arcs with outliers. Assert rejection of hyperbolic, singular, non-finite, and implausibly eccentric fits.

- [ ] **Step 3: Confirm the tests fail**

Run: `pnpm test -- src/calibration/wheelArcs.test.ts src/calibration/wheelEllipse.test.ts`

- [ ] **Step 4: Implement arc tracing and normalized conic fitting**

Use spatial buckets for bounded neighbor lookup. Fit normalized ellipse conics, convert valid fits to canonical geometry, and perform three fixed residual/inlier refinement passes. Limit proposal count before expensive evidence measurement.

- [ ] **Step 5: Replace connected-component proposal generation**

Make `detectWheelEllipses` consume `extractWheelEdges` and `traceWheelArcs`. Remove the filled-region masks and component-moment approximation after the new regression cases pass.

- [ ] **Step 6: Run tests and commit**

Run: `pnpm test -- src/calibration/wheelArcs.test.ts src/calibration/wheelEllipse.test.ts src/calibration/wheelEllipseFixtures.test.ts`

```bash
git add src/calibration/wheelArcs.ts src/calibration/wheelArcs.test.ts src/calibration/wheelEllipse.ts src/calibration/wheelEllipse.test.ts
git commit -m "feat: fit wheel ellipses from rim arcs"
```

## Task 4: Verify the complete circumference and rank pottery candidates

**Files:**

- Modify: `src/calibration/wheelEllipse.ts`
- Modify: `src/calibration/wheelEllipse.test.ts`
- Modify: `src/calibration/wheelEllipseFixtures.test.ts`
- Modify: `src/calibration/wheelHead.ts`
- Modify: `src/calibration/wheelHead.test.ts`

**Interfaces:**

```ts
export type WheelEllipseEvidence = {
  fitResidualPx95: number;
  visibleArcFraction: number;
  longestMissingArcFraction: number;
  supportedSectors: Uint8Array;
  orientationAgreement: number;
};
export type WheelDetectionResult = {
  candidates: WheelEllipseCandidate[];
  quality: WheelCaptureQuality;
};
```

- [ ] **Step 1: Write failing circumference-evidence tests**

Sample fitted circumference sectors and assert correct detection of complete support, small tolerated gaps, missing quadrants, long missing sectors, and incompatible edge orientation.

- [ ] **Step 2: Write failing ranking tests**

Assert that complete-rim evidence outranks filled area, valid lower-region candidates outrank faces and apron graphics, clipped candidates are rejected, nested rims remain outer-to-inner selectable, and results are deterministic.

- [ ] **Step 3: Confirm the tests fail**

Run: `pnpm test -- src/calibration/wheelEllipse.test.ts src/calibration/wheelEllipseFixtures.test.ts src/calibration/wheelHead.test.ts`

- [ ] **Step 4: Implement evidence measurement and hard gates**

Measure nearest compatible edge support in fixed circumference sectors. Require all four quadrants, a minimum supported fraction, a bounded longest missing run, plausible size/aspect ratio, frame clearance, and working space above the rim before a candidate is auto-supportable.

- [ ] **Step 5: Implement normalized candidate scoring and compatibility output**

Score supported fraction, residual, orientation agreement, location, size, workspace, and concentric evidence. Deduplicate near-identical ellipses and return at most three candidates. Keep `detectWheelHead` as the compatibility entry point, but remove its legacy gradient-pair search once all callers consume the new result.

- [ ] **Step 6: Run tests and commit**

Run: `pnpm test -- src/calibration/wheelEdges.test.ts src/calibration/wheelArcs.test.ts src/calibration/wheelEllipse.test.ts src/calibration/wheelEllipseFixtures.test.ts src/calibration/wheelHead.test.ts`

```bash
git add src/calibration/wheelEllipse.ts src/calibration/wheelEllipse.test.ts src/calibration/wheelEllipseFixtures.test.ts src/calibration/wheelHead.ts src/calibration/wheelHead.test.ts
git commit -m "feat: require complete wheel rim evidence"
```

## Task 5: Strengthen live tracking and expose capture guidance

**Files:**

- Modify: `src/calibration/useLiveWheelDetection.ts`
- Modify: `src/calibration/useLiveWheelDetection.test.tsx`
- Modify: `src/calibration/WheelLiveOverlay.tsx`
- Modify: `src/calibration/WheelLiveOverlay.test.tsx`
- Modify: `src/live/LiveSession.tsx`
- Modify: `src/live/LiveSession.test.tsx`

**Interfaces:**

- `LiveWheelDetection` exposes the current `quality` and highest-priority `guidance`.
- Tracking state distinguishes tentative, steady, found, and capture-quality blocked states.

- [ ] **Step 1: Write failing frame-sequence tests**

Cover stable lock, a one-frame distractor, two short misses, a persistent replacement candidate, gradual drift, candidate switching, and reset after camera interruption. Require repeated matched evidence before switching and the full lock interval before acceptance.

- [ ] **Step 2: Write failing guidance tests**

Assert that blur, low contrast, glare, incomplete rim, clipped rim, and unstable geometry map to one actionable message in stable priority order.

- [ ] **Step 3: Confirm the tests fail**

Run: `pnpm test -- src/calibration/useLiveWheelDetection.test.tsx src/calibration/WheelLiveOverlay.test.tsx src/live/LiveSession.test.tsx`

- [ ] **Step 4: Implement tracked candidate association**

Match by normalized center, radii, rotation, and evidence. Retain the tracked candidate through a bounded miss budget, reset the stability timer on meaningful drift, and require repeated observations before adopting an unrelated candidate.

- [ ] **Step 5: Render quality guidance without hiding manual controls**

Pass the structured reason through the live hook and display its single highest-priority instruction in the existing movable overlay. Keep tentative geometry visually distinct from locked geometry.

- [ ] **Step 6: Run tests and commit**

Run: `pnpm test -- src/calibration/useLiveWheelDetection.test.tsx src/calibration/WheelLiveOverlay.test.tsx src/live/LiveSession.test.tsx`

```bash
git add src/calibration/useLiveWheelDetection.ts src/calibration/useLiveWheelDetection.test.tsx src/calibration/WheelLiveOverlay.tsx src/calibration/WheelLiveOverlay.test.tsx src/live/LiveSession.tsx src/live/LiveSession.test.tsx
git commit -m "feat: stabilize live wheel tracking and guidance"
```

## Task 6: Preserve manual evidence and agent handoff correctly

**Files:**

- Modify: `src/calibration/wheelEllipse.ts`
- Modify: `src/calibration/wheelHead.ts`
- Modify: `src/calibration/wheelHead.test.ts`
- Modify: `src/calibration/useLiveWheelDetection.ts`
- Modify: `src/calibration/useLiveWheelDetection.test.tsx`
- Modify: `src/live/LiveSession.tsx`
- Modify: `src/live/LiveSession.test.tsx`
- Modify: `src/voice/tools/registry.test.ts`
- Modify: `tests/e2e/wheel-head.spec.ts`

**Interfaces:**

- Store detector evidence separately from user-selected geometry.
- `currentEllipse()` remains synchronous and authoritative after manual editing.
- `wheelEllipseCalibration` receives explicit provenance and evidence instead of rewriting confidence fields.

- [ ] **Step 1: Write failing manual-handoff tests**

Verify that voice and touch confirmation use the latest manual geometry synchronously, detector samples cannot replace it while editing, confirmation persists it into session calibration, and a camera interruption invalidates it.

- [ ] **Step 2: Write failing hard-gate tests**

Verify manual selection cannot confirm clipped geometry, an implausible aspect ratio, insufficient workspace, or a predicted circumference outside the frame. Verify manual selection is permitted when the full rim is visibly available but automatic proposal confidence was insufficient.

- [ ] **Step 3: Confirm the tests fail**

Run: `pnpm test -- src/calibration/wheelHead.test.ts src/calibration/useLiveWheelDetection.test.tsx src/live/LiveSession.test.tsx src/voice/tools/registry.test.ts`

- [ ] **Step 4: Separate geometry provenance from detector evidence**

Remove the current behavior that overwrites manual ellipse residual, arc coverage, and confidence with perfect values. Carry user-confirmed geometry and available edge evidence independently, validate hard geometry/visibility gates, and preserve `manual-assisted` provenance through the resulting calibration.

- [ ] **Step 5: Extend the browser workflow test**

Exercise start detection, move the manual controls, adjust the ellipse, confirm through the same path used by the agent tool, and assert the accepted calibration uses the edited geometry.

- [ ] **Step 6: Run tests and commit**

Run: `pnpm test -- src/calibration/wheelHead.test.ts src/calibration/useLiveWheelDetection.test.tsx src/live/LiveSession.test.tsx src/voice/tools/registry.test.ts`

Run: `pnpm exec playwright test tests/e2e/wheel-head.spec.ts --project=chromium-wheel-camera`

```bash
git add src/calibration/wheelEllipse.ts src/calibration/wheelHead.ts src/calibration/wheelHead.test.ts src/calibration/useLiveWheelDetection.ts src/calibration/useLiveWheelDetection.test.tsx src/live/LiveSession.tsx src/live/LiveSession.test.tsx src/voice/tools/registry.test.ts tests/e2e/wheel-head.spec.ts
git commit -m "fix: preserve manual wheel calibration handoff"
```

## Task 7: Add performance coverage and complete validation

**Files:**

- Create: `benchmarks/camera/wheelEllipse.ts`
- Modify: `benchmarks/camera/run.ts`
- Modify: `README.md` or the existing calibration documentation selected during implementation

- [ ] **Step 1: Add a deterministic detector benchmark**

Measure preprocessing, proposal generation, evidence scoring, and total detection time at the actual downscaled live resolution across clean, cluttered, nested, and low-contrast scenes. Fail the benchmark if the median total exceeds the 200 ms sample budget on the project benchmark environment.

- [ ] **Step 2: Document the supported capture envelope**

State that the entire wheel-head or bat rim must be visible, identify the supported browser-only milestone, and avoid real-world accuracy claims before physical validation.

- [ ] **Step 3: Run focused and full validation**

Run: `pnpm benchmark:camera`

Run: `pnpm test`

Run: `pnpm lint`

Run: `pnpm format:check`

Run: `pnpm typecheck`

Run: `pnpm build`

Run: `pnpm exec playwright test tests/e2e/wheel-head.spec.ts --project=chromium-wheel-camera`

- [ ] **Step 4: Commit benchmark and documentation**

```bash
git add benchmarks/camera/wheelEllipse.ts benchmarks/camera/run.ts README.md docs
git commit -m "test: benchmark robust wheel detection"
```

## Task 8: Review and prepare the pull request

- [ ] **Step 1: Inspect the complete branch diff against `main`**

Run: `git diff --check main...HEAD`

Run: `git diff --stat main...HEAD`

- [ ] **Step 2: Use the requesting-code-review skill**

Resolve sound findings and repeat affected validation.

- [ ] **Step 3: Push the branch and open a new pull request**

Summarize the new edge/arc pipeline, complete-rim enforcement, tracking behavior, manual handoff, performance results, and exact validation commands.
