# Foundation and Camera Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline, task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an installable mobile web scaffold with explicit permissions, rear-camera preview, bounded worker frame delivery, interruption handling, and reproducible device diagnostics.

**Architecture:** React/Vite owns UI and session lifecycle. `CameraController` exposes browser media without leaking React concerns; a feature-selected `FrameSource` posts at most one pending ROI frame to a dedicated worker. Diagnostics keep each clock separate.

**Tech Stack:** Node `>=24 <25`, pnpm `>=10 <11`, TypeScript `~7.0.2`, React/ReactDOM `~19.3.0`, Vite `~7.1.3`, Vitest `~5.0.3`, Testing Library `~16.3.0`, Playwright `~1.58.0`, `vite-plugin-pwa ~1.1.0`, Zod `~4.1.0`.

## Global Constraints

- Secure context; one explicit start gesture; no camera/mic request on page load.
- Preview target >=24 fps; worker delivery target 10 fps; queue length <=1; UI diagnostics <=10 Hz.
- Background, orientation change, ended/muted track, or changed device makes readings stale.
- No raw frames persist or cross the network.
- Commit `pnpm-lock.yaml`; use exact resolved versions thereafter.

---

### Task 1: Scaffold and capability contract

**Files:** Create `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/platform/capabilities.ts`, `src/platform/capabilities.test.ts`, `src/styles.css`, `public/manifest.webmanifest`; modify `README.md`.

**Interfaces:** Produces `type Capabilities={camera:boolean;microphone:boolean;offscreenCanvas:boolean;trackProcessor:boolean;videoFrameCallback:boolean;wakeLock:boolean;webRtc:boolean}` and `detectCapabilities():Capabilities`.

- [ ] Write `capabilities.test.ts` first with injected globals asserting absent APIs are `false` and that `trackProcessor` never controls `camera` support.
- [ ] Run `pnpm vitest run src/platform/capabilities.test.ts`; expect failure resolving `./capabilities`.
- [ ] Add the exact interface above, pure detection, accessible unsupported-browser screen, PWA manifest, lint/typecheck/test/build scripts, and `engines`.
- [ ] Run `pnpm test && pnpm typecheck && pnpm build`; expect all tests pass and `dist/index.html` exists.
- [ ] Commit `chore: scaffold pottery coach web client` with all listed files.

### Task 2: Permission and camera lifecycle

**Files:** Create `src/camera/types.ts`, `src/camera/CameraController.ts`, `src/camera/CameraController.test.ts`, `src/camera/CameraSetup.tsx`, `src/camera/CameraSetup.test.tsx`; modify `src/App.tsx`.

**Interfaces:** `CameraController.start(constraints?:MediaStreamConstraints):Promise<{stream:MediaStream;settings:CameraSettings}>`; `stop():void`; `switchDevice(deviceId:string):Promise<...>`; `subscribe(listener:(CameraEvent)=>void):()=>void`; `CameraEvent` is `started|settings|muted|unmuted|ended|interrupted|error` with timestamp/reason.

- [ ] Write tests using fake `MediaStreamTrack`: no call before button click; default request is `video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30}}`; delivered `getSettings()` wins; stop calls every track; `visibilitychange` hidden emits `interrupted`.
- [ ] Run the two test files; expect module failures and then assertion failures before implementation.
- [ ] Implement controller and setup UI with local-camera disclosure, separate later mic disclosure, retry/switch controls, `playsInline`, delivered settings, denied/not-found/in-use messages, and track cleanup on unmount.
- [ ] Run unit tests; expect all pass. Run `pnpm playwright test tests/e2e/camera-permission.spec.ts --project=chromium` after creating the spec with fake-media flags; expect preview state and stop state pass.
- [ ] Commit `feat: add explicit camera permission lifecycle`.

### Task 3: Bounded frame pipeline

**Files:** Create `src/camera/FrameSource.ts`, `src/camera/CanvasFrameSource.ts`, `src/camera/FrameSource.test.ts`, `src/vision/measurement.worker.ts`, `src/vision/workerProtocol.ts`, `src/vision/workerProtocol.test.ts`; modify `CameraSetup.tsx`.

**Interfaces:** `FrameSource.start(video, {targetFps,roi}, sink):void`; `stop():void`; sink accepts `{frameId,capturedAtMs,bitmap}` and returns `"accepted"|"busy"`; worker protocol initially replies `{type:"diagnostic",frameId,processingMs,droppedBefore}`.

- [ ] Write fake-clock tests proving 30 fps input sends <=10 frames/s, a busy sink drops/replaces rather than queues, stop cancels callbacks, and transferred bitmaps are closed on rejection/response.
- [ ] Run `pnpm vitest run src/camera/FrameSource.test.ts src/vision/workerProtocol.test.ts`; expect missing implementations.
- [ ] Implement `requestVideoFrameCallback` path with timer fallback, `createImageBitmap` ROI transfer, OffscreenCanvas worker echo/close, and single-flight backpressure. Add feature flag for future TrackProcessor; do not implement it here.
- [ ] Run tests plus a 60-second Playwright fake-camera test that asserts sent minus completed minus dropped is never >1; expect pass.
- [ ] Commit `feat: add bounded camera worker pipeline`.

### Task 4: Diagnostics, wake behavior, and benchmark harness

**Files:** Create `src/diagnostics/FrameDiagnostics.ts`, `.test.ts`, `src/diagnostics/DiagnosticsPanel.tsx`, `benchmarks/camera/index.html`, `benchmarks/camera/run.ts`, `benchmarks/camera/result.schema.json`, `tests/e2e/interruption.spec.ts`, `docs/device-test-protocol.md`; modify `src/App.tsx`, `vite.config.ts`.

**Interfaces:** `FrameDiagnostics.record(kind:"preview"|"acquired"|"processed"|"rendered", timestampMs, frameId?):void`; `snapshot():DiagnosticSample`; JSONL output conforms to observability spec.

- [ ] Write tests for sliding-window rates, p50/p95 frame age, dropped count, and reset after hidden/resume; write interruption E2E expecting stale banner and explicit resume.
- [ ] Run tests; expect missing diagnostic module and interruption assertion failures.
- [ ] Implement 1 Hz snapshots, `performance.memory` only when present, Battery API only when present, wake-lock request/reacquire behind feature detection, JSONL download, and the 20-minute harness modes `camera-only` and `camera-worker`.
- [ ] Run `pnpm test && pnpm typecheck && pnpm build && pnpm playwright test`; expect green. Run `pnpm benchmark:camera -- --duration=60 --mode=camera-worker` on desktop; expect a schema-valid JSONL artifact, not a gate pass.
- [ ] On one recent iPhone/Safari, one Android/Chrome, and desktop Chrome, run two 20-minute camera-only and worker sessions; accept only preview >=24 fps, processed >=10 fps, no monotonic memory growth, no reload/thermal termination. Record delivered settings and failures.
- [ ] Update `docs/research/10-benchmark-results.md` and Gate 1 record. Review checkpoint: frontend/performance reviewer verifies permission teardown, bounded memory, and real-device traces.
- [ ] Commit `test: add camera diagnostics and device gate`.

## Rollback/fallback

Disable PWA registration if lifecycle differs from browser mode. Fall back from OffscreenCanvas/ImageBitmap to main-thread 640×360 canvas at 5 Hz while keeping preview live. If target iPhones still fail, stop after Gate 1, document native trigger, and do not begin measurement implementation.

## Documentation requirements

README must cover HTTPS/local setup, fake camera tests, physical device procedure, privacy behavior, and supported-device ledger. No browser becomes “supported” without linked 20-minute artifacts.
