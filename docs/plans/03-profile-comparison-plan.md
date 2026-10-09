# Profile Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline, task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver curated cylinder targets, explicit wet/fired sizing, regional profile comparison, overlay, and goal progress without arbitrary-image automation.

**Architecture:** Versioned JSON templates are pure normalized data. A pure comparison module scales and aligns profiles by calibrated height rows; React renders the same returned samples, avoiding a second geometry implementation.

**Tech Stack:** Existing stack; Zod `~4.1.0`; D3 scale/shape modules `~7.9.0` only if bundle analysis shows <20 kB gzip, otherwise native SVG.

## Global Constraints

- Begin with Gate 2 passed or an explicit normalized-only scope.
- No universal shrinkage default; fired goals require explicit fraction and display the equation.
- Coaching region output requires >=70% valid coverage and fresh eligible measurement.

---

### Task 1: Template schema and library

**Files:** Create `src/targets/types.ts`, `src/targets/schema.ts`, `.test.ts`, `src/targets/templates/straight-cylinder-v1.json`, `tapered-cylinder-v1.json`, `src/targets/loadTemplates.ts`, `.test.ts`.

**Interfaces:** Exact `TargetProfile`, `TargetSource`, and 101-sample contract from spec; `loadTemplates():TargetProfile[]`.

- [ ] Write tests rejecting non-monotonic height ratios, !=101 samples, negative radii, missing provenance, confidence outside [0,1], and accepting the two reviewed templates.
- [ ] Run tests; expect missing schema.
- [ ] Implement schema/loader and explicit template values generated from documented linear functions; store generator parameters and revision in each JSON.
- [ ] Run tests/typecheck; expect two stable sorted templates.
- [ ] Commit `feat: add versioned target templates`.

### Task 2: Wet/fired goal sizing

**Files:** Create `src/goals/types.ts`, `src/goals/sizeGoal.ts`, `.test.ts`, `src/goals/GoalForm.tsx`, `.test.tsx`.

**Interfaces:** `ThrowingGoal={id:string;targetId:string;basis:"wet"|"fired";desiredHeightMm:number;desiredMaximumWidthMm:number|null;shrinkageFraction:number|null}`; `toWetGoal(goal):GoalConfirmation`.

- [ ] Write tests: 300 mm fired with 12% shrinkage yields 340.91 mm wet; fired without shrinkage blocks; wet uses input unchanged; reject shrinkage <0 or >0.25 and dimensions outside configured supported bounds.
- [ ] Run tests; expect missing functions/UI.
- [ ] Implement form with equation/assumption review, spoken-goal-compatible parser boundary, and persisted confirmed goal only.
- [ ] Run tests; expect accessible errors and exact rounding only at display.
- [ ] Commit `feat: add explicit target sizing goals`.

### Task 3: Regional comparison engine

**Files:** Create `src/targets/compareProfiles.ts`, `.test.ts`, `src/targets/syntheticProfiles.test.ts`, `benchmarks/profile/generate.ts`, `summarize.ts`.

**Interfaces:** `compareProfiles(reading:StableDimensionReading,target:TargetProfile):ProfileComparison` exact spec type.

- [ ] Write analytic tests for ±2/5/10/20 mm perturbations in each region, missing blocks, asymmetric input, height mismatch, signed direction, MAE <=0.5 mm noise-free, monotonic rankings, and null region below 70% coverage.
- [ ] Run tests; expect missing comparison module.
- [ ] Implement 101-row resampling without bridging >5-sample gaps, confidence weighting, region boundaries, signed median, MAE, coverage, and secondary IoU.
- [ ] Run `pnpm vitest run src/targets`; expect all analytic assertions pass. Run benchmark generator twice with seed 42; expect byte-identical result JSON.
- [ ] Commit `feat: compare profiles by coaching region`.

### Task 4: Overlay and progress

**Files:** Create `src/targets/ProfileOverlay.tsx`, `.test.tsx`, `src/targets/GoalProgress.tsx`, `.test.tsx`, `tests/e2e/target-flow.spec.ts`; modify live session screen.

**Interfaces:** Consumes `TargetProfile`, `StableDimensionReading`, `ProfileComparison`; emits no derived measurements.

- [ ] Write UI tests for mirrored target/current paths, invalid gap breaks, non-color legend, millimetre/normalized modes, top regional deviation, and low-confidence suppression; E2E selects template and completes wet/fired confirmation.
- [ ] Run tests; expect components absent.
- [ ] Implement native SVG overlay using comparison samples, accessible text summary, goal milestone events at instructor-configurable 80/95/100% height with hysteresis.
- [ ] Run full test/build/E2E; expect no displayed regional claim below coverage/confidence.
- [ ] Browser acceptance: verify overlay alignment after orientation on supported iPhone/Android; compare screenshot geometry to golden within Playwright 0.5% pixel difference on desktop.
- [ ] Review checkpoint: vision reviewer validates metric; pottery reviewer labels templates/milestones. Update docs and commit `feat: add target overlay and goal progress`.

## Rollback/fallback

If millimetre calibration scope is narrowed, run normalized-only comparison and label it. Disable fired sizing when shrinkage is absent. If overlay harms frame rate >10%, render at 5 Hz and retain text summary. Arbitrary reference-image automation remains outside this plan; manual trace can be scheduled only after curated flow passes.

## Documentation requirements

Document template provenance/revision, region definitions, sign convention, coverage rules, shrinkage math/limitations, screenshot/accessibility acceptance, and Benchmark 3 results.
