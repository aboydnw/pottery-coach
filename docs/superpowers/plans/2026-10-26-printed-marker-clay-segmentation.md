# Printed Marker Calibration and Clay Segmentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline, task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the printed marker the primary calibration experience and establish a local, measurable clay-segmentation pipeline that can accept trained weights after a real labeled corpus exists.

**Architecture:** Extend the existing AprilTag board workflow instead of replacing its tested homography solver. Add a focused marker setup component, explicit wheel-diameter cross-checks, stable multi-frame acceptance, and a common segmentation-provider output consumed by deterministic cleanup and measurement code. Add a privacy-local, versioned example format and export utilities so future model training and held-out evaluation use evidence captured by the real app.

**Tech Stack:** React 19, TypeScript 7, Vitest, Testing Library, existing Web Worker measurement pipeline, existing AprilTag WASM adapter, SVG print asset, browser Blob downloads.

## Global Constraints

- Browser first; contracts remain portable to a future iPhone application.
- Calibration page lies flat on the wheel head and its center target aligns with the wheel axis.
- Remember wheel-head diameter and use it only as a plausibility cross-check; the printed marker remains the primary metric reference.
- Camera frames, segmentation, and saved examples remain local unless the user explicitly exports them.
- Initial physical accuracy target is 12.7 mm at the 95th percentile; do not claim it until the physical gate passes.
- Quantitative readings are withheld when calibration, segmentation, visibility, freshness, or stability is insufficient.
- This plan does not invent production ML weights. A learned provider can be promoted only after labeled real-world data beats the deterministic baseline on the frozen evaluation split.

---

### Task 1: Marker-centered calibration geometry and stability

**Files:**
- Create: `src/calibration/boardCalibration.ts`
- Test: `src/calibration/boardCalibration.test.ts`
- Modify: `src/calibration/types.ts`
- Modify: `src/calibration/calibrateFromVideo.ts`
- Modify: `src/measurement/scale.ts`

**Interfaces:**
- Consumes: `CalibrationResult`, `Point2`, `BOARD_V1`, and the existing image-to-board homography.
- Produces: `BoardPose`, `CalibrationObservation`, `BoardCalibrationAccumulator`, `validateWheelDiameterCrossCheck(result, diameterMm)`, and board center information carried by `SessionScale`.

- [ ] **Step 1: Write failing geometry and stability tests**

```ts
it("maps the board center back to the wheel center in image pixels", () => {
  const pose = boardPoseFromCalibration(identityBoardCalibration(), 350);
  expect(pose.wheelCenterImage).toEqual({ x: 105, y: 74 });
});

it("accepts five consistent observations spanning 500 ms", () => {
  const accumulator = new BoardCalibrationAccumulator();
  for (let index = 0; index < 5; index += 1)
    accumulator.add(observation(index * 125, 100 + index * 0.1, 80));
  expect(accumulator.result()?.status).toBe("accepted");
});

it("rejects an entered wheel diameter that differs by more than ten percent", () => {
  expect(validateWheelDiameterCrossCheck(calibrationWithExpectedDiameter(350), 250)).toContain("DIAMETER_MISMATCH");
});
```

- [ ] **Step 2: Run the focused tests and confirm they fail because the new module and types do not exist**

Run: `pnpm test src/calibration/boardCalibration.test.ts`

- [ ] **Step 3: Implement board pose, cross-check, and stable observation aggregation**

Implement pure functions that invert the existing homography to map the board's 105×74 mm center into image coordinates, carry the calibrated supported region, compare five observations using center/scale/reprojection tolerances, and return stable reason codes. Add optional `boardPose` to `CalibrationResult` and `SessionScale` without breaking stored wheel-head sessions.

- [ ] **Step 4: Re-run calibration and scale tests**

Run: `pnpm test src/calibration/boardCalibration.test.ts src/measurement/scale.test.ts src/calibration/homography.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/calibration/boardCalibration.ts src/calibration/boardCalibration.test.ts src/calibration/types.ts src/calibration/calibrateFromVideo.ts src/measurement/scale.ts
git commit -m "feat: derive stable marker calibration pose"
```

### Task 2: Printable page and marker-first setup experience

**Files:**
- Create: `src/calibration/PrintedMarkerStep.tsx`
- Test: `src/calibration/PrintedMarkerStep.test.tsx`
- Modify: `src/calibration/boardV1.ts`
- Modify: `src/calibration/boardV1.test.ts`
- Modify: `public/calibration/board-v1.svg`
- Modify: `src/live/LiveSession.tsx`
- Modify: `src/live/LiveSession.test.tsx`
- Modify: `src/calibration/CalibrationFlow.tsx`
- Modify: `src/calibration/CalibrationFlow.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: remembered diameter utilities, `CalibrationResult`, `runBoardCalibration`, and `skipWheel`.
- Produces: `PrintedMarkerStep` callbacks `onDiameter(diameterMm)`, `onCalibrate()`, `onUseWheelHead()`, and `onSkip()`.

- [ ] **Step 1: Write failing component tests for the default path**

```tsx
it("makes the printed page the primary setup path", () => {
  render(<PrintedMarkerStep initialDiameterMm={355.6} busy={false} onDiameter={vi.fn()} onCalibrate={vi.fn()} onUseWheelHead={vi.fn()} onSkip={vi.fn()} />);
  expect(screen.getByRole("heading", { name: /calibrate with the printed page/i })).toBeVisible();
  expect(screen.getByText(/place it flat on the wheel head/i)).toBeVisible();
  expect(screen.getByRole("link", { name: /open printable page/i })).toHaveAttribute("href", "/calibration/board-v1.svg");
});
```

Add LiveSession coverage proving printed calibration appears before wheel-head detection and that wheel-head detection is labeled optional.

- [ ] **Step 2: Run the focused tests and confirm the missing component/default-path failures**

Run: `pnpm test src/calibration/PrintedMarkerStep.test.tsx src/live/LiveSession.test.tsx`

- [ ] **Step 3: Implement the marker-first component and update the generated board**

The component includes diameter entry, the print link, ruler confirmation, flat/centered placement instructions, and primary Calibrate button. Update the SVG generator with a visible center target, four radial alignment ticks, concise placement text, and a phone-movement warning. Regenerate `public/calibration/board-v1.svg` with `pnpm calibration:board`.

- [ ] **Step 4: Integrate stable capture and acceptance**

Change `LiveSession` so marker mode is the default. Repeated calibration taps/samples feed the accumulator; only a stable result reaches `CalibrationFlow`. Pass the confirmed diameter into the cross-check. Keep “Use wheel-head detection instead” and “Skip sizes” as secondary actions. Update copy that currently says to stand the board beside the pot.

- [ ] **Step 5: Run UI, board, and accessibility-focused tests**

Run: `pnpm test src/calibration/PrintedMarkerStep.test.tsx src/calibration/boardV1.test.ts src/calibration/CalibrationFlow.test.tsx src/live/LiveSession.test.tsx`

- [ ] **Step 6: Commit**

```bash
git add src/calibration/PrintedMarkerStep.tsx src/calibration/PrintedMarkerStep.test.tsx src/calibration/boardV1.ts src/calibration/boardV1.test.ts public/calibration/board-v1.svg src/live/LiveSession.tsx src/live/LiveSession.test.tsx src/calibration/CalibrationFlow.tsx src/calibration/CalibrationFlow.test.tsx src/styles.css
git commit -m "feat: make printed marker the primary calibration"
```

### Task 3: Clay segmentation provider and deterministic baseline

**Files:**
- Create: `src/vision/ClaySegmenter.ts`
- Create: `src/vision/BackgroundClaySegmenter.ts`
- Test: `src/vision/BackgroundClaySegmenter.test.ts`
- Create: `src/vision/clayMask.ts`
- Test: `src/vision/clayMask.test.ts`
- Modify: `src/vision/segmentVessel.ts`
- Modify: `src/vision/measurement.worker.ts`
- Modify: `src/vision/workerProtocol.ts`

**Interfaces:**
- Consumes: `LabImage`, `BackgroundModel`, calibrated ROI, and exclusion regions.
- Produces: `ClaySegmentationOutput`, `ClaySegmenter`, `BackgroundClaySegmenter`, and `cleanClayProbability(output, context): SegmentationResult`.

- [ ] **Step 1: Write failing contract and cleanup tests**

```ts
it("emits a versioned probability mask through the common provider contract", async () => {
  const output = await new BackgroundClaySegmenter(background).segment(input);
  expect(output.modelVersion).toBe("background-v1");
  expect([...output.probability]).toEqual([0, 1, 1, 0]);
});

it("rejects a high-probability component that does not reach the wheel band", () => {
  expect(cleanClayProbability(floatingMask, context).span).toBeNull();
});
```

- [ ] **Step 2: Run the focused tests and verify missing-module failures**

Run: `pnpm test src/vision/BackgroundClaySegmenter.test.ts src/vision/clayMask.test.ts`

- [ ] **Step 3: Implement the provider boundary and shared cleanup**

Move component selection and row-reliability logic behind `cleanClayProbability`. Adapt existing LAB background difference into a versioned probability output without changing its validated threshold behavior. Keep morphology and mask buffers bounded.

- [ ] **Step 4: Route the worker through the provider-compatible path**

The current worker uses `background-v1`; its emitted readings include `segmentationVersion`. Worker messages remain serializable. Runtime failure produces an invalidation reason rather than a plausible stale measurement.

- [ ] **Step 5: Run vision and worker tests**

Run: `pnpm test src/vision/BackgroundClaySegmenter.test.ts src/vision/clayMask.test.ts src/vision/segmentVessel.test.ts src/vision/workerProtocol.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/vision/ClaySegmenter.ts src/vision/BackgroundClaySegmenter.ts src/vision/BackgroundClaySegmenter.test.ts src/vision/clayMask.ts src/vision/clayMask.test.ts src/vision/segmentVessel.ts src/vision/measurement.worker.ts src/vision/workerProtocol.ts
git commit -m "feat: add a model-ready clay segmentation boundary"
```

### Task 4: Local labeled-example format and explicit export

**Files:**
- Create: `src/vision/dataset/types.ts`
- Create: `src/vision/dataset/example.ts`
- Test: `src/vision/dataset/example.test.ts`
- Create: `src/vision/dataset/export.ts`
- Test: `src/vision/dataset/export.test.ts`
- Create: `src/vision/dataset/DatasetControls.tsx`
- Test: `src/vision/dataset/DatasetControls.test.tsx`

**Interfaces:**
- Consumes: downscaled frame bytes, automatic probability mask, corrected binary mask or no-clay/unusable verdict, calibration geometry, condition tags, and consent/license metadata.
- Produces: `ClayDatasetExampleV1`, `validateDatasetExample`, `exportDataset(examples): Blob`, and opt-in controls that never upload.

- [ ] **Step 1: Write failing schema and privacy tests**

```ts
it("rejects an example without an explicit review verdict", () => {
  expect(() => createDatasetExample({ ...validInput, verdict: undefined })).toThrow(/verdict/i);
});

it("exports only versioned examples and no account, voice, or precise timestamp fields", async () => {
  const text = await exportDataset([example]).text();
  expect(text).toContain('"schemaVersion":"clay-dataset-v1"');
  expect(text).not.toMatch(/email|transcript|createdAtMs/);
});
```

- [ ] **Step 2: Run the tests and confirm missing-module failures**

Run: `pnpm test src/vision/dataset/example.test.ts src/vision/dataset/export.test.ts src/vision/dataset/DatasetControls.test.tsx`

- [ ] **Step 3: Implement the minimal versioned format and JSONL export**

Use coarse condition tags and a session-group identifier so later splitting happens by session. Encode masks with row-length encoding and image bytes as an explicitly supplied data URL. Validate dimensions and mask lengths. The exporter produces a deterministic JSONL Blob plus a manifest header; it does not call `fetch`.

- [ ] **Step 4: Implement opt-in controls**

Controls remain hidden unless testing mode is enabled. They show the local example count, require a reviewed verdict, export only on a user click, and support deleting one or all examples. Storage integration remains adapter-based so IndexedDB can be added without changing the schema.

- [ ] **Step 5: Run dataset tests**

Run: `pnpm test src/vision/dataset/example.test.ts src/vision/dataset/export.test.ts src/vision/dataset/DatasetControls.test.tsx`

- [ ] **Step 6: Commit**

```bash
git add src/vision/dataset
git commit -m "feat: define private clay dataset export"
```

### Task 5: Evaluation gates and model promotion manifest

**Files:**
- Create: `src/vision/modelManifest.ts`
- Test: `src/vision/modelManifest.test.ts`
- Create: `benchmarks/clay-segmentation/metrics.ts`
- Test: `benchmarks/clay-segmentation/metrics.test.ts`
- Create: `benchmarks/clay-segmentation/run.ts`
- Create: `benchmarks/clay-segmentation/README.md`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: reviewed dataset examples, baseline/model masks, physical millimetres-per-pixel evidence, latency samples, and immutable model metadata.
- Produces: `ClayModelManifest`, `summarizeClaySegmentation`, `passesClayModelGate`, and `pnpm benchmark:clay-segmentation`.

- [ ] **Step 1: Write failing metric and gate tests**

```ts
it("does not promote a model that misses the no-clay false-positive gate", () => {
  expect(passesClayModelGate({ ...passing, noClayFalsePositiveRate: 0.021 })).toBe(false);
});

it("splits evaluation identity by session rather than neighboring frame", () => {
  expect(assertDisjointSessions(train, evaluation)).toEqual([]);
});
```

- [ ] **Step 2: Run the focused tests and verify missing-module failures**

Run: `pnpm test src/vision/modelManifest.test.ts benchmarks/clay-segmentation/metrics.test.ts`

- [ ] **Step 3: Implement metrics and immutable manifest validation**

Compute intersection-over-union, boundary error summaries, empty-scene false-positive rate, occlusion-suppression recall, and latency p95. Require model version, dataset version, SHA-256, input size, threshold, and evaluation results. Encode the exact promotion thresholds from the specification.

- [ ] **Step 4: Add a benchmark command that evaluates supplied JSONL rather than pretending fixtures are production data**

With no dataset argument, print usage and exit successfully. With a dataset, compare `background-v1` and a supplied candidate result file, refuse overlapping train/evaluation session IDs, and write a JSON summary without modifying model manifests.

- [ ] **Step 5: Document the honest promotion workflow**

Explain capture, review, session-level split, offline training, candidate export, benchmark comparison, device latency testing, checksum verification, and manual promotion. State explicitly that this PR includes no promoted learned weights.

- [ ] **Step 6: Run tests and benchmark help**

Run: `pnpm test src/vision/modelManifest.test.ts benchmarks/clay-segmentation/metrics.test.ts`

Run: `pnpm benchmark:clay-segmentation`

- [ ] **Step 7: Commit**

```bash
git add src/vision/modelManifest.ts src/vision/modelManifest.test.ts benchmarks/clay-segmentation package.json README.md
git commit -m "test: gate learned clay segmentation models"
```

### Task 6: Cross-feature verification and documentation reconciliation

**Files:**
- Modify: `docs/specs/camera-calibration-spec.md`
- Modify: `docs/specs/measurement-engine-spec.md`
- Modify: `docs/device-test-protocol.md`
- Modify: `docs/privacy-notice.md`
- Modify: `docs/release-checklist.md`

**Interfaces:**
- Consumes: the completed marker flow, provider contract, dataset schema, and promotion gates.
- Produces: consistent operator documentation and release requirements.

- [ ] **Step 1: Update documentation to make marker calibration primary**

Remove “board beside the pot” language, document flat centered placement, remembered diameter cross-check, shape-only fallback, camera-lock invalidation, explicit dataset export, and the 12.7 mm unverified target.

- [ ] **Step 2: Run placeholder and contradiction scans**

Run: `rg -n "stand it beside|wheel-head edge check|T[B]D|T[O]DO" README.md docs src/voice/instructions.ts`

Any remaining wheel-head wording must explicitly describe an optional fallback. Update voice instructions so the coach asks for marker calibration first and does not invite clay until calibration is confirmed or skipped.

- [ ] **Step 3: Add or update voice instruction tests**

Run: `pnpm test src/voice/instructions.test.ts`

- [ ] **Step 4: Run the complete verification suite**

Run: `pnpm test`

Run: `pnpm lint`

Run: `pnpm format:check`

Run: `pnpm typecheck`

Run: `pnpm build`

Run: `pnpm exec playwright test tests/e2e/wheel-head.spec.ts --project=chromium-wheel-camera`

- [ ] **Step 5: Review the delivered scope against the specification**

Confirm that printed calibration is primary, the wheel detector is optional, frames do not upload, exported examples require an explicit user action, model promotion cannot occur without held-out evidence, and the UI makes no unverified half-inch accuracy claim.

- [ ] **Step 6: Commit**

```bash
git add docs README.md src/voice/instructions.ts src/voice/instructions.test.ts
git commit -m "docs: align coaching with marker-first measurement"
```

## Rollback/fallback

The existing wheel-head flow remains reachable as an optional fallback and shape-only coaching remains available. Existing stored calibrations are readable because new pose fields are optional. If the provider boundary causes runtime problems, the worker can continue calling the existing `segmentVessel` facade backed by `background-v1`. No learned model is activated until its manifest passes the held-out accuracy and device-performance gate.

## Documentation requirements

Publish the printable page instructions, supported placement, remembered diameter behavior, camera-movement warning, local-only dataset behavior, export/delete controls, model version and checksum rules, corpus consent/license requirements, physical accuracy results, and the signed model-promotion decision.
