# Calibration and Measurement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline, task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add printed-board calibration, controlled segmentation, dimension/profile readings, confidence/freshness, and a physical accuracy gate.

**Architecture:** A pinned WASM tag detector supplies correspondences; pure TypeScript geometry calculates/rejects calibration; the existing worker rectifies/segments/extracts profiles and publishes instantaneous/stable readings. Algorithms remain fixture-testable outside React.

**Tech Stack:** Plan 1 stack; `@pottery/apriltag-wasm` vendored from a pinned audited commit with SHA-256, or a custom OpenCV.js WASM build if the detector spike fails; `fast-check ~4.3.0` for geometry properties.

## Global Constraints

- Begin only after Gate 1 passes on listed devices or an explicit narrowed-support decision exists.
- Board revision and print scale are verified; marker plane within the benchmarked offset band.
- Quantitative speech eligibility is not part of this plan, but reading thresholds match the measurement spec.
- Null/unmeasurable is preferred to a plausible wrong contour.

---

### Task 1: Board asset and calibration math

**Files:** Create `public/calibration/board-v1.svg`, `src/calibration/types.ts`, `src/calibration/homography.ts`, `src/calibration/homography.test.ts`, `src/calibration/quality.ts`, `src/calibration/quality.test.ts`, `scripts/verify-calibration-board.mjs`.

**Interfaces:** Exact `CalibrationResult` and `CalibrationQuality` from the spec; `solveCalibration(corners,board,frame):CalibrationResult`; `validateCalibration(result):string[]`.

- [ ] Write tests with known projective transforms: recovered board points <=0.25 px; degenerate/collinear inputs reject; 9° pose, 2.1% scale variation, 1.6 px residual, clipped ROI, and wrong board revision each reject with stable reason codes.
- [ ] Run tests; expect missing modules.
- [ ] Implement normalized DLT/homography inversion, residual/scale calculations, initial thresholds, SVG with four `tagStandard41h12` IDs, 100 mm ruler, baseline, axis, revision/checksum, and script that verifies SVG dimensions/checksum.
- [ ] Run tests and `node scripts/verify-calibration-board.mjs`; expect `board-v1: valid, 100.0 mm reference`.
- [ ] Commit `feat: define calibration board and geometry`.

### Task 2: Detector adapter and setup flow

**Files:** Create `src/calibration/TagDetector.ts`, `src/calibration/WasmTagDetector.ts`, `.test.ts`, `src/calibration/CalibrationFlow.tsx`, `.test.tsx`, `src/calibration/fixtures/*.json`; modify worker protocol and `App.tsx`; document `third_party/apriltag/LICENSE`, `SOURCE.md`, checksum.

**Interfaces:** `TagDetector.detect(frame):Promise<Array<{id:number;corners:[Point2,Point2,Point2,Point2];decisionMargin:number}>>`; `CalibrationFlow` emits accepted `CalibrationResult` or rejection reasons.

- [ ] Write contract tests against stored synthetic tag images and UI tests for auto success, manual baseline/axis review, non-overridable hard failure, and recalibration on board movement.
- [ ] Run tests; expect adapter/UI failures.
- [ ] Build/pin detector artifact, isolate it in the worker, close memory allocations deterministically, implement overlay/manual correction provenance, and validate print ruler confirmation.
- [ ] Run tests and `pnpm benchmark:tags -- --fixtures src/calibration/fixtures`; expect all clear fixtures detected and corrupt/wrong-ID fixtures rejected; record latency without claiming mobile pass.
- [ ] Commit `feat: add hybrid fiducial calibration`.

### Task 3: Segmentation and profile extraction

**Files:** Create `src/vision/backgroundModel.ts`, `.test.ts`, `src/vision/morphology.ts`, `.test.ts`, `src/vision/segmentVessel.ts`, `.test.ts`, `src/measurement/extractProfile.ts`, `.test.ts`, `src/measurement/types.ts`; modify worker.

**Interfaces:** `buildBackground(frames):BackgroundModel`; `segmentVessel(rectified,model,exclusions):SegmentationResult`; `extractDimensions(mask,rowReliability,calibration):DimensionReading` using exact spec types.

- [ ] Write fixtures/tests for four synthetic clay colors, specular holes, wheel exclusion, detached hand/tool components, clipped/branched contours, maximum-width p95, rim/base bands, 64 samples with null gaps, and asymmetry sign/magnitude.
- [ ] Run tests; expect missing modules.
- [ ] Implement LAB distance with robust median/MAD model, 3×3 open/5×5 close, compatible wheel-band component selection, reliability reasons, row extraction, and buffer reuse.
- [ ] Run unit/property tests; expect analytic dimensions within 1 pixel and invalid occluded rows null.
- [ ] Commit `feat: extract calibrated vessel dimensions`.

### Task 4: Confidence and temporal stability

**Files:** Create `src/measurement/confidence.ts`, `.test.ts`, `src/measurement/temporalFilter.ts`, `.test.ts`; modify worker and live overlay.

**Interfaces:** `scoreConfidence(inputs):MeasurementConfidence`; `TemporalFilter.push(reading):StableDimensionReading|null`; `reset(reason):void`.

- [ ] Write tests for minimum-component behavior, error bound propagation, 5-sample requirement, Hampel rejection, weighted EMA, gap preservation, freshness growth, and reset on calibration/visibility change.
- [ ] Run tests; expect failures.
- [ ] Implement component reasons, 5-row median, gap-safe Savitzky–Golay, MAD/Hampel temporal rejection, 400 ms confidence-weighted EMA, and instant/stable overlay distinction.
- [ ] Run all unit/E2E tests; expect no retained current value during occlusion and no stale eligibility.
- [ ] Commit `feat: add measurement confidence and stable readings`.

### Task 5: Accuracy and segmentation gates

**Files:** Create `benchmarks/dimensions/manifest.schema.json`, `run.ts`, `summarize.ts`, `benchmarks/segmentation/manifest.schema.json`, `run.ts`, `docs/calibration-fixture-protocol.md`; modify benchmark results and risk register.

- [ ] Write summarizer tests with failing fixture results proving median/p95/bias/rejection/unmeasurable gates fail correctly; expect missing summarizer first.
- [ ] Implement immutable JSONL runner/summarizer and exact matrices from research 07/10; run synthetic fixtures and validate schemas.
- [ ] Print/measure board, collect five independent physical setups per size/offset/angle/placement, then collect locked segmentation corpus. Expected gate: median <=5 mm, p95 <=10 mm, bias <=5 mm, supported acceptance >=95%, unsupported rejection >=95%; segmentation median boundary <=3 mm, p95 <=10 mm, >30% occlusion unmeasurable recall >=95%.
- [ ] Review checkpoint: vision reviewer inspects raw distributions and exclusions; privacy reviewer verifies footage consent. Record Gate 2 pass, narrowed support, or fail.
- [ ] Commit `test: record measurement viability gate`.

## Rollback/fallback

If WASM tags fail, compare a custom OpenCV.js ArUco build behind the same adapter. If millimetre accuracy fails, narrow pose/offset/size and rerun; if still >10 mm p95, expose normalized ratios only and remove quantitative speech. If segmentation misses, tighten environmental requirements before adding a learned model.

## Documentation requirements

Publish board printing instructions, supported placement/angle/distance, error bounds, rejection explanations, dependency license/source/checksum, corpus consent, and the signed Gate 2 decision.
