# Architecture decision record

Status: provisional, 2026-10-08. Decisions marked **gate-bound** reverse automatically when the named threshold fails.

## Scope decision — 2026-10-09

Implementation proceeds through Plans 2–9 as a web application without waiting at the individual physical gates. Mobile-browser optimization remains required because integrated testing will include a real phone after all planned subsystems are implemented. A native mobile application is explicitly deferred. Unrun gates remain closed, claims remain prototype-only, and no browser/device becomes supported until the final integrated evidence is recorded.

## ADR-001 — React + Vite PWA

**Decision:** React 19, Vite 7, TypeScript 7, browser APIs directly, Workbox/Vite PWA manifest only after the camera path works.

**Why:** the app has meaningful UI/session state but its hot loop is client-side; Vite avoids a server-rendering runtime. Minimal TypeScript saves little after routing, accessibility, testing, and session views are added. Next.js adds server conventions without improving frame processing.

**Rejected:** Next.js as default; framework-free DOM app. **Fallback:** static non-installable web app if PWA lifecycle causes regressions.

## ADR-002 — portable canvas path first

**Decision:** capture through `<video>` plus `requestVideoFrameCallback` where available and copy a bounded ROI into `OffscreenCanvas`/worker; use main-thread canvas fallback. Add `MediaStreamTrackProcessor` only after capability tests.

**Evidence:** MDN labels `MediaStreamTrackProcessor` limited availability and notes inconsistent global exposure ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrackProcessor), accessed 2026-10-08). **Gate-bound:** Gate 1.

## ADR-003 — independent clocks

Preview >=24 fps; camera-delivery sampled at native rate; vision target 10 Hz; UI <=10 Hz; coach observation publication 2 Hz/event-driven; multimodal snapshot 0 Hz by default and <=0.1 Hz when explicitly enabled. Backpressure drops old frames; it never queues unbounded work.

## ADR-004 — hybrid planar calibration

Use a printable 100 mm ArUco-compatible square board for four-corner homography/pose plus manual two-point recovery and visible wheel-rim line confirmation. The marker must be near the vessel plane. Known wheel diameter is a plausibility check, not sole scale, because the wheel appears foreshortened.

**Rejected:** ruler only (weak pose); wheel diameter only (ellipse/occlusion); automatic marker only (brittle failure); full checkerboard (setup burden). **Gate-bound:** Gate 2; if the web build lacks reliable ArUco, use a custom high-contrast square with corner detection and printed checksum.

## ADR-005 — geometry before learned segmentation

Controlled backdrop → LAB/HSV distance threshold → morphology → compatible connected components → contour/profile. Measure a custom lightweight model only if valid-frame acceptance fails. Promptable segmentation is excluded from the realtime loop.

## ADR-006 — measurement contract and epistemic boundary

Every reading includes calibration, segmentation, visibility, temporal stability, and freshness. Null is a valid measurement. Stable coaching readings require >=0.75 overall confidence and <=750 ms freshness; proactive shape cues require >=0.82 and <=500 ms. The system says “visually centered from this view,” never “perfectly centered.”

## ADR-007 — regional radial error

Normalize both profiles to 64 vertical samples and compare signed radial error in lower/middle/upper thirds plus rim/base bands. Report millimetres only when target dimensions and calibration are valid; otherwise report normalized ratios. Global similarity is secondary.

## ADR-008 — conservative wobble estimator

Estimate camera translation from static fiducial/background features; subtract it; track rim center, mid-profile center, and left/right boundaries across >=3 estimated revolutions; fit sinusoidal components robustly; suppress during hand occlusion, active large shape change, camera-motion residual, and low rotation confidence.

**Gate-bound:** Gate 3. Failure removes proactive warnings; it does not block dimensions/profile V1.

## ADR-009 — OpenAI Realtime transport default, provider abstraction mandatory

Official OpenAI documentation recommends WebRTC for browser/mobile clients and documents stateful speech, image input, function calling, server VAD, and response cancellation ([WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc), [Realtime conversations](https://developers.openai.com/api/docs/guides/realtime-conversations), accessed 2026-10-08). Use a backend unified-session endpoint so the long-lived API key never reaches the browser. Gemini Live remains the benchmark alternative; its official docs support browser WebSocket ephemeral tokens, function calling, interruption, and resumable sessions ([overview](https://ai.google.dev/gemini-api/docs/live-api), [ephemeral tokens](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens), accessed 2026-10-08).

Provider retention and actual cost must be re-verified at implementation time. **Gate-bound:** Gate 4.

## ADR-010 — hybrid coaching

Local observations feed deterministic rules; a finite state supplies context; priority/cooldown arbitration decides whether to speak; the LLM may phrase verified facts and answer questions only through functions. Urgent local cues never await the LLM. Every spoken quantitative claim references a `readingId` in the audit record.

## ADR-011 — local-first records and opt-in footage

IndexedDB stores bounded structured records. Raw video is not stored or uploaded by default. Stills are local and user-marked unless explicit research consent permits upload. Delete is immediate locally and queues provider/backend deletion where applicable. Retention defaults to 30 days for structured prototype records, configurable downward.
