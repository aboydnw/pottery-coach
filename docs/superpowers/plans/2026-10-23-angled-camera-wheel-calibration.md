# Angled-Camera Wheel Calibration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline, task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect the complete wheel rim as an ellipse, derive a constrained angled-camera view pose from its known diameter, guide setup with an automatic overlay, and use pose-aware coordinates for metric vessel measurement.

**Architecture:** A deterministic ellipse detector returns ranked candidates; a separate pose estimator converts the selected ellipse and remembered wheel diameter into a serializable view pose. The UI confirms or edits that geometry, and the measurement worker constructs a pure `WheelPoseTransform` so metric extraction never silently relies on one frame-wide scale.

**Tech Stack:** TypeScript 7, React 19, Canvas/SVG, Web Workers, Vitest, Testing Library, Playwright, deterministic benchmark runners; no new runtime dependency.

## Global Constraints

- Ask for wheel-head or bat diameter once per saved setup; reacquire pose every session.
- Require the complete circular rim and sufficient vessel space above it.
- Call the result a view-pose/downward-angle estimate, never literal camera height.
- Use the orthographic/weak-perspective circle-to-ellipse model and rotational-symmetry assumption explicitly.
- Manual adjustment cannot override hard pose, framing, or uncertainty gates.
- Preserve board calibration and shape-only degradation.
- Do not claim a supported physical angle range or real-world accuracy until the physical gate passes.
- Add no learned model or computer-vision runtime in this milestone.

---

## File structure

- `src/calibration/wheelEllipse.ts`: ellipse types, fitting, scoring, and ranked candidate detection.
- `src/calibration/wheelViewPose.ts`: pure ellipse-to-pose derivation and reason codes.
- `src/calibration/WheelEllipseConfirm.tsx`: overlay, candidate switching, accessible manual correction, and stable auto-accept.
- `src/measurement/WheelPoseTransform.ts`: pose-aware image-to-wheel coordinate conversion.
- Existing calibration, worker, setup, and benchmark files integrate those focused units.

### Task 1: Define and validate wheel ellipse and view-pose geometry

**Files:**
- Create: `src/calibration/wheelEllipse.ts`
- Create: `src/calibration/wheelEllipse.test.ts`
- Create: `src/calibration/wheelViewPose.ts`
- Create: `src/calibration/wheelViewPose.test.ts`
- Modify: `src/calibration/types.ts`

**Interfaces:**
- Produces: `WheelEllipse`, `WheelEllipseCandidate`, `WheelViewPose`, `deriveWheelViewPose(ellipse, diameterMm, frame)`, and `CALIBRATION_REASON` values consumed by later tasks.

- [ ] **Step 1: Write failing canonicalization and pose tests**

```ts
it("derives downward angle and wheel-plane scale from a known circle", () => {
  const pose = deriveWheelViewPose(
    { centerX: 320, centerY: 300, radiusMajor: 150, radiusMinor: 75, rotationRad: 0,
      fitResidualPx95: 0.5, visibleArcFraction: 1, confidence: 0.95 },
    300,
    { width: 640, height: 480 },
  );
  expect(pose.downwardAngleRad).toBeCloseTo(Math.acos(0.5));
  expect(pose.wheelPlaneMmPerMajorPixel).toBeCloseTo(1);
  expect(pose.reasons).toEqual([]);
});

it("rejects a clipped working region instead of accepting manual geometry", () => {
  const pose = deriveWheelViewPose(ellipseAt(320, 110), 300, { width: 640, height: 480 });
  expect(pose.reasons).toContain("WORKING_REGION_CLIPPED");
});
```

- [ ] **Step 2: Run the focused tests and confirm missing-module failures**

Run: `pnpm test -- src/calibration/wheelEllipse.test.ts src/calibration/wheelViewPose.test.ts`

- [ ] **Step 3: Implement normalized types and pose derivation**

Implement `canonicalWheelEllipse`, vector normalization, `acos(clamp(radiusMinor / radiusMajor))`, major-axis scale, projected vertical orientation, supported-region calculation, estimated error, confidence, and stable reason ordering. Extend `CalibrationQuality` with `ellipseFitResidualPx95` and `visibleArcFraction`, both nullable for legacy/board records.

- [ ] **Step 4: Run the focused tests**

Run: `pnpm test -- src/calibration/wheelEllipse.test.ts src/calibration/wheelViewPose.test.ts`

- [ ] **Step 5: Commit the geometry contract**

```bash
git add src/calibration/types.ts src/calibration/wheelEllipse.ts src/calibration/wheelEllipse.test.ts src/calibration/wheelViewPose.ts src/calibration/wheelViewPose.test.ts
git commit -m "feat: define angled wheel view geometry"
```

### Task 2: Detect and rank complete wheel-rim ellipses

**Files:**
- Modify: `src/calibration/wheelEllipse.ts`
- Modify: `src/calibration/wheelEllipse.test.ts`
- Modify: `src/calibration/wheelHead.ts`
- Modify: `src/calibration/wheelHead.test.ts`

**Interfaces:**
- Consumes: canonical types from Task 1.
- Produces: `detectWheelEllipses(image: GrayImage): WheelEllipseCandidate[]`; keeps `detectWheelHead` as a compatibility adapter during migration.

- [ ] **Step 1: Add rendered-fixture tests**

Render high-contrast ellipses at 10°, 20°, 30°, rotation ±8°, image offsets, deterministic noise, partial occlusion, and nested splash-pan/bat radii. Assert center/radii within 3 px, rotation within 2°, `visibleArcFraction >= 0.8` for complete rims, incomplete-rim rejection, and inner/outer candidate order.

- [ ] **Step 2: Confirm the new tests fail**

Run: `pnpm test -- src/calibration/wheelEllipse.test.ts src/calibration/wheelHead.test.ts`

- [ ] **Step 3: Implement deterministic detection**

Extract signed-gradient rim points, bucket them by lower-frame rows, seed closed conic candidates, fit ellipses with normalized direct least squares, refine with three deterministic residual/inlier passes, and score residual, arc coverage, frame size, aspect ratio, and working clearance. Return at most three non-duplicate nested candidates.

- [ ] **Step 4: Adapt the legacy entry point**

Map the leading ellipse to `leftX`, `rightX`, and `row` for callers not migrated yet; include `ellipse` on each candidate. Preserve the current fallback candidate with confidence zero.

- [ ] **Step 5: Run detection tests and commit**

Run: `pnpm test -- src/calibration/wheelEllipse.test.ts src/calibration/wheelHead.test.ts`

```bash
git add src/calibration/wheelEllipse.ts src/calibration/wheelEllipse.test.ts src/calibration/wheelHead.ts src/calibration/wheelHead.test.ts
git commit -m "feat: detect complete wheel rim ellipses"
```

### Task 3: Build ellipse-based calibration with hard quality gates

**Files:**
- Modify: `src/calibration/wheelHead.ts`
- Modify: `src/calibration/wheelHead.test.ts`
- Modify: `src/calibration/quality.ts`
- Modify: `src/calibration/quality.test.ts`
- Modify: `src/calibration/CalibrationFlow.tsx`

**Interfaces:**
- Produces: `wheelEllipseCalibration({ ellipse, diameterMm, frameWidth, frameHeight, adjustedByUser })` returning `CalibrationResult` with `wheelEllipse` and `wheelViewPose`.

- [ ] **Step 1: Write failing calibration and reason-code tests**

Assert accepted automatic provenance for a supported ellipse, `manual-assisted` without bypass for an unsupported edited ellipse, and exact codes for incomplete rim, shallow/steep view, off-axis view, clipped working region, unstable/ambiguous detection, and excessive fit error.

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm test -- src/calibration/wheelHead.test.ts src/calibration/quality.test.ts`

- [ ] **Step 3: Replace scale-only calibration construction**

Store the selected ellipse and pose. Retain an identity-compatible homography only for legacy serialization, mark it non-authoritative in the type comment, and make new measurement code consume `wheelViewPose`. Update `describeCalibrationReason` with the approved plain-language copy.

- [ ] **Step 4: Run calibration tests and commit**

Run: `pnpm test -- src/calibration/wheelHead.test.ts src/calibration/quality.test.ts src/calibration/CalibrationFlow.test.tsx`

```bash
git add src/calibration/wheelHead.ts src/calibration/wheelHead.test.ts src/calibration/quality.ts src/calibration/quality.test.ts src/calibration/CalibrationFlow.tsx
git commit -m "feat: calibrate from angled wheel pose"
```

### Task 4: Replace line confirmation with an automatic ellipse overlay

**Files:**
- Create: `src/calibration/WheelEllipseConfirm.tsx`
- Create: `src/calibration/WheelEllipseConfirm.test.tsx`
- Modify: `src/app/SessionFlow.tsx`
- Modify: `src/styles.css`
- Delete after migration: `src/calibration/WheelHeadConfirm.tsx`
- Delete after migration: `src/calibration/WheelHeadConfirm.test.tsx`

**Interfaces:**
- Consumes: ranked candidates and `deriveWheelViewPose`.
- Produces: `onConfirm(ellipse)`, `onSwitch(index)`, `onRetry()`, and `onAdjustingChange(boolean)` events.

- [ ] **Step 1: Write failing interaction tests**

Use fake timers to assert auto-confirm only after a supported candidate stays within center 2%, radii 2%, and rotation 2° for 750 ms; **Adjust** cancels the timer; low confidence never auto-confirms; candidate buttons switch nested rims; keyboard controls change center/radii/rotation; mirroring preserves image coordinates; unsupported manual edits keep confirmation disabled.

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm test -- src/calibration/WheelEllipseConfirm.test.tsx`

- [ ] **Step 3: Implement the overlay and accessible editor**

Render the still on canvas and an SVG `<ellipse>`, center mark, major/minor axes, projected vessel axis, and supported-region outline. Expose sliders named “Wheel center horizontal”, “Wheel center vertical”, “Wheel width”, “Wheel depth”, and “Wheel rotation”; provide 44 px touch targets and plain status guidance.

- [ ] **Step 4: Integrate session setup and remove the line editor**

Pass every captured candidate into the new component, maintain the selected index, create calibration from the confirmed ellipse, and retain retry/shape-only paths.

- [ ] **Step 5: Run UI tests and commit**

Run: `pnpm test -- src/calibration/WheelEllipseConfirm.test.tsx src/app/SessionFlow.test.tsx`

```bash
git add src/calibration/WheelEllipseConfirm.tsx src/calibration/WheelEllipseConfirm.test.tsx src/app/SessionFlow.tsx src/styles.css src/calibration/WheelHeadConfirm.tsx src/calibration/WheelHeadConfirm.test.tsx
git commit -m "feat: guide setup with a wheel ellipse overlay"
```

### Task 5: Add a pose-aware measurement transform

**Files:**
- Create: `src/measurement/WheelPoseTransform.ts`
- Create: `src/measurement/WheelPoseTransform.test.ts`
- Modify: `src/measurement/extractProfile.ts`
- Modify: `src/measurement/extractProfile.test.ts`
- Modify: `src/measurement/types.ts`

**Interfaces:**
- Produces: `SerializedMeasurementTransform`, `MeasurementTransform`, `createWheelPoseTransform(pose)`, and `extractDimensions(..., { transform })`.

```ts
type SerializedMeasurementCalibration =
  | { kind: "wheel-pose"; calibrationId: string; pose: WheelViewPose }
  | { kind: "board-homography"; calibrationId: string; imageToMm: CalibrationResult["homographyImageToMm"];
      estimatedErrorMm95: number };
type MeasurementTransform = {
  imageToWheel(point: Point2): { radialMm: number; verticalMm: number } | null;
  radiusAt(left: Point2, right: Point2, verticalMm: number): number | null;
  estimatedErrorMm95At(point: Point2): number;
};
```

- [ ] **Step 1: Write synthetic projection round-trip tests**

Project stepped rotational profiles with known 100/200/300 mm heights and 40–200 mm widths at ellipse ratios representing the supported angle fixtures. Assert height and regional widths within the synthetic error envelope, increasing `estimatedError95` away from the wheel plane, and null metric values outside the supported region.

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm test -- src/measurement/WheelPoseTransform.test.ts src/measurement/extractProfile.test.ts`

- [ ] **Step 3: Implement the pure transform**

Rotate image points into ellipse-axis coordinates, resolve projected vertical displacement with the inclination estimate, convert boundary pairs to radius under rotational symmetry, and return point-specific uncertainty. Keep normalized pixel extraction as a separate explicit path for shape-only sessions.

- [ ] **Step 4: Refactor extraction to consume the transform**

Replace `unitsPerPixel` and horizontal-row assumptions with corrected boundary points. Preserve 64 profile samples, null gaps, confidence fields, and existing pixel behavior when `mode: "shape-only"` is supplied. Do not pass the pose-aware output through `toMm` a second time.

- [ ] **Step 5: Run measurement tests and commit**

Run: `pnpm test -- src/measurement/WheelPoseTransform.test.ts src/measurement/extractProfile.test.ts src/targets/compareProfiles.test.ts`

```bash
git add src/measurement/WheelPoseTransform.ts src/measurement/WheelPoseTransform.test.ts src/measurement/extractProfile.ts src/measurement/extractProfile.test.ts src/measurement/types.ts
git commit -m "feat: measure profiles in wheel pose coordinates"
```

### Task 6: Carry view pose through the worker without breaking shape-only mode

**Files:**
- Modify: `src/vision/workerProtocol.ts`
- Modify: `src/vision/workerProtocol.test.ts`
- Modify: `src/vision/measurement.worker.ts`
- Modify: `src/vision/useMeasurementPipeline.ts`
- Modify: `src/measurement/scale.ts`
- Modify: `src/measurement/scale.test.ts`

**Interfaces:**
- Replaces the worker `scale` message with `{ type: "calibration"; calibration: SerializedMeasurementCalibration | null }`.
- Produces metric readings directly when pose calibration exists and pixel readings in shape-only mode.

- [ ] **Step 1: Write failing protocol and conversion tests**

Assert serializable pose transfer, calibration resend after worker restart/background reset, no double conversion of `unit: "mm"`, null wobble tracking without metric calibration, and invalidation after calibration removal.

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm test -- src/vision/workerProtocol.test.ts src/measurement/scale.test.ts`

- [ ] **Step 3: Implement protocol and worker integration**

Construct the transform inside the worker, use it during extraction, set calibration confidence/reasons from the pose, and retain shape-only output. Rename the hook API from `setScale` to `setCalibration` and update callers. Add `BoardHomographyTransform` implementing the same `MeasurementTransform` interface so existing printed-board calibration remains functional.

- [ ] **Step 4: Run worker and pipeline tests and commit**

Run: `pnpm test -- src/vision/workerProtocol.test.ts src/measurement/scale.test.ts src/app/AppSessionOrchestrator.test.ts`

```bash
git add src/vision/workerProtocol.ts src/vision/workerProtocol.test.ts src/vision/measurement.worker.ts src/vision/useMeasurementPipeline.ts src/measurement/scale.ts src/measurement/scale.test.ts src/app
git commit -m "feat: apply wheel pose in the measurement worker"
```

### Task 7: Preserve one-time diameter setup and migrate legacy records

**Files:**
- Modify: `src/setup/SetupStore.ts`
- Modify: `src/setup/SetupStore.test.ts`
- Modify: `src/session/migrations.ts`
- Modify: `src/session/migrations.test.ts`
- Modify: `src/calibration/WheelHeadStep.tsx`
- Modify: `src/calibration/WheelHeadStep.test.tsx`

**Interfaces:**
- Produces remembered diameter/unit preference while never restoring a trusted live pose.

- [ ] **Step 1: Write failing persistence and migration tests**

Assert returning setup preselects diameter, begins fresh ellipse acquisition, corrupt storage falls back safely, legacy edge-only calibration remains readable in history, and legacy calibration cannot start a new metric live session.

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm test -- src/setup/SetupStore.test.ts src/session/migrations.test.ts src/calibration/WheelHeadStep.test.tsx`

- [ ] **Step 3: Implement persistence boundaries and copy**

Persist `{ diameterMm, preferredUnit }` as the reusable physical setup. Remove live pose from any remembered setup payload. Change the step text to explain that the size is remembered but the camera view is checked each time.

- [ ] **Step 4: Run tests and commit**

Run: `pnpm test -- src/setup/SetupStore.test.ts src/session/migrations.test.ts src/calibration/WheelHeadStep.test.tsx`

```bash
git add src/setup/SetupStore.ts src/setup/SetupStore.test.ts src/session/migrations.ts src/session/migrations.test.ts src/calibration/WheelHeadStep.tsx src/calibration/WheelHeadStep.test.tsx
git commit -m "feat: remember wheel size without reusing camera pose"
```

### Task 8: Extend benchmarks, browser journeys, and public documentation

**Files:**
- Modify: `benchmarks/shared/syntheticScene.ts`
- Modify: `benchmarks/shared/measureScene.ts`
- Modify: `benchmarks/dimensions/fixtures.json`
- Modify: `benchmarks/dimensions/run.ts`
- Modify: `benchmarks/dimensions/summarize.ts`
- Modify: `benchmarks/dimensions/summarize.test.ts`
- Modify: `tests/e2e/calibration-board.spec.ts`
- Create: `tests/e2e/angled-wheel-calibration.spec.ts`
- Modify: `README.md`
- Modify: `docs/research/10-benchmark-results.md`
- Modify: `docs/specs/camera-calibration-spec.md`
- Modify: `docs/specs/measurement-engine-spec.md`

**Interfaces:**
- Produces angle-stratified synthetic evidence without upgrading the physical validation status.

- [ ] **Step 1: Add failing benchmark-summary tests**

Require results grouped by synthetic downward angle, dimension error, ellipse parameter error, unsupported-pose rejection, unmeasurable rate, and processing time. Ensure a runner cannot improve reported accuracy by omitting rejected fixtures.

- [ ] **Step 2: Add angle-stratified fixtures and run the focused benchmark tests**

Include supported synthetic cases at 10°, 20°, 30°, and 35° plus shallow, steep, clipped, incomplete-rim, off-axis, nested-rim, and camera-motion negatives. Run: `pnpm test -- benchmarks/dimensions/summarize.test.ts`

- [ ] **Step 3: Add browser setup journeys**

Verify remembered diameter, overlay display, auto-accept, **Adjust** cancellation, nested selection, low-confidence instruction, and shape-only fallback using deterministic rendered video.

- [ ] **Step 4: Update documentation conservatively**

Describe the angled-camera assumption, ellipse-based experimental calibration, rotational-symmetry limitation, and open physical gate. Remove language implying that a single constant wheel-head scale already corrects perspective.

- [ ] **Step 5: Run the complete verification suite**

Run: `pnpm lint`

Run: `pnpm format:check`

Run: `pnpm test`

Run: `pnpm typecheck`

Run: `pnpm build`

Run: `pnpm e2e`

Run: `pnpm benchmark:dimensions`

Run: `pnpm benchmark:segmentation`

Run: `git diff --check`

- [ ] **Step 6: Commit evidence and documentation**

```bash
git add benchmarks tests/e2e README.md docs/research/10-benchmark-results.md docs/specs/camera-calibration-spec.md docs/specs/measurement-engine-spec.md
git commit -m "test: validate angled camera calibration"
```

### Task 9: Review the complete PR and publish the branch

**Files:**
- Review all files changed since commit `67871e2`.

**Interfaces:**
- Produces: a clean, verified PR 12 branch with no unsupported claims.

- [ ] **Step 1: Inspect the final diff and repository status**

Run: `git status --short`

Run: `git diff 67871e2 --stat`

Run: `git diff 67871e2 --check`

- [ ] **Step 2: Re-run affected tests after review fixes**

Run the focused commands from the task owning every review fix, then run `pnpm verify`.

- [ ] **Step 3: Push PR 12 and inspect checks**

Run: `git push origin feat/coach-brain`

Run: `gh pr checks 12`

- [ ] **Step 4: Report evidence precisely**

Report automated results, synthetic accuracy by angle, rejected/unmeasurable cases, and any remaining physical validation gates. Do not convert synthetic results into public real-world accuracy claims.
