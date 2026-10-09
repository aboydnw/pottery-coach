# Integrated Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline, task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Join setup, calibration, cylinder/template goal, live measurement, voice, coaching, and review into one deployable controlled prototype with independent degraded modes.

**Architecture:** `AppSessionOrchestrator` composes existing public interfaces without bypassing their gates. Route-level error boundaries and capability flags allow camera, measurement, voice, wobble, and storage to fail independently. A release manifest names every gate/config revision.

**Tech Stack:** Existing stack; React Router `~8.4.0`; deployment target chosen from an HTTPS static host plus same-origin serverless function; no new analytics SDK.

## Global Constraints

- Plans 1–7 tests pass. Failed Gate 3 disables proactive wobble; failed Gate 4 selects local-only voice mode; failed Gate 2 blocks numeric mode.
- Default raw-video network/storage bytes equal zero.
- Release is a controlled prototype, not production or safety equipment.

---

### Task 1: Orchestrator and route state

**Files:** Create `src/app/AppSessionOrchestrator.ts`, `.test.ts`, `src/app/routes.tsx`, `src/app/featureFlags.ts`, `.test.ts`, `src/app/ErrorBoundary.tsx`; modify `App.tsx`.

**Interfaces:** State `notice→camera→calibration→audio-consent→goal→live→review`; events are typed and invalid transitions reject/audit. Flags are derived from signed gate manifest, not arbitrary local storage.

- [ ] Write tests for happy path, permission denial/retry, calibration loss mid-session, voice disconnect, storage failure, background/resume, end/delete, browser reload recovery, and every invalid transition.
- [ ] Run tests; expect missing orchestrator.
- [ ] Implement reducer/orchestrator, URL routes, resumable non-sensitive session shell, error boundaries, and capability/gate-derived flags.
- [ ] Run tests; expect each subsystem degradation preserves allowed functions.
- [ ] Commit `feat: integrate prototype session lifecycle`.

### Task 2: End-to-end cylinder and template flows

**Files:** Create `tests/e2e/fixtures/session-streams.ts`, `cylinder-flow.spec.ts`, `template-flow.spec.ts`, `degraded-flow.spec.ts`; modify screens/navigation.

**Interfaces:** Use mock camera frames, detector outputs, measurement stream, and realtime transport through public interfaces only.

- [ ] Write failing E2E covering notice/permissions/calibration/goal, height question with evidence, barge-in, target difference, pause/resume freshness, marked moment, end/review/delete; degraded tests for numeric/voice/wobble/storage flags.
- [ ] Run Playwright; expect route/integration failures.
- [ ] Wire screens with persistent capture indicators, large wet-hand controls, status captions, orientation-safe layout, and no hidden auto-start.
- [ ] Run all E2E on Chromium/WebKit emulation; expect exact flows pass and no console/network errors.
- [ ] Commit `feat: complete cylinder and template journeys`.

### Task 3: Performance, network, and privacy integration

**Files:** Create `benchmarks/integrated/run.ts`, `summarize.ts`, schemas, `tests/e2e/network-boundary.spec.ts`, `memory-soak.spec.ts`, `docs/integrated-test-protocol.md`; modify diagnostics.

- [ ] Write network test failing on image/video MIME, frame-sized binary/base64, unknown domain, or content payload when snapshot consent off; write soak test failing pending-frame/recorder queue bounds.
- [ ] Run tests; expect diagnostic/integration failures.
- [ ] Implement adaptive modes: 10→7.5→5 Hz based on p95 processing/frame age; 640×360 ROI floor; never lower preview; emit mode-change event. Add strict CSP/connect-src/media-src and redaction.
- [ ] Run desktop 20-minute mock soak and network test; expect bounded queues/memory proxy and zero frame payloads.
- [ ] On supported iPhone/Android, run two 20-minute voice+vision sessions plus poor-network/background/orientation cases. Pass Gate 5 only if processing-rate drop <20% from camera-only, p95 frame age <=500 ms, no monotonic memory growth/reload/thermal termination, and voice targets remain met.
- [ ] Commit `perf: validate integrated mobile session`.

### Task 4: Deployment and release evidence

**Files:** Create `deploy/headers.json`, `deploy/config.md`, `src/release/manifest.ts`, `.test.ts`, `docs/runbook.md`, `docs/release-checklist.md`; modify README.

- [ ] Write manifest test requiring commit, schema/policy/instruction/provider/board/template revisions, gate decisions, supported devices, feature flags, and privacy notice revision.
- [ ] Implement deployment config with HTTPS, CSP, Permissions-Policy, no-store on session endpoint, immutable hashed assets, error/rollback health checks.
- [ ] Deploy staging using approved credentials; run `pnpm test && pnpm typecheck && pnpm build && pnpm playwright test --config playwright.staging.config.ts`; expect green and session endpoint secret boundary intact.
- [ ] Conduct traceability Gate 6: scripted corpus yields every numeric utterance linked to fresh confident evidence and zero violations. Review checkpoint: architecture/security/privacy/performance sign release manifest.
- [ ] Commit `chore: package controlled pottery coach prototype` and tag `prototype-v1-rc1` only after evidence is attached.

## Rollback/fallback

Deploy previous immutable artifact and revoke affected realtime session configuration. Flags can disable voice, proactive cues, wobble, or numeric measurement independently. If integrated Gate 5 fails after rate/ROI fallback, keep desktop research build and invoke native-app assessment rather than declaring mobile support.

## Documentation requirements

Runbook covers setup, secrets, flags, monitoring, provider outage, calibration invalidation, deletion incident, rollback, and support bounds. Release checklist links each product criterion to E2E/benchmark/instructor evidence.
