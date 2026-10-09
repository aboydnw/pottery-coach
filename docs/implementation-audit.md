# Plans 2–9 implementation audit

Status date: 2026-10-09. This audit separates implemented web software and automated evidence from the deliberately consolidated physical/provider/human gates. A pending gate is not a pass.

| Plan | Implemented evidence | Automated evidence | Consolidated evidence still pending |
|---|---|---|---|
| 2 Calibration and measurement | Versioned printable board/checksum, homography/quality rejection, worker-isolated AprilTag adapter, segmentation/profile extraction, confidence/temporal filtering, signed-error benchmark runners | Calibration, detector, segmentation, morphology, extraction, confidence, temporal, board-verification, dimension and segmentation summarizer tests | Printed-board repeats, known-object locked corpus, studio footage consent/review, Gate 2 signature |
| 3 Profile comparison | Versioned 101-sample templates, explicit wet/fired sizing and spoken parser boundary, gap-preserving regional comparison, accessible overlay, hysteretic milestones | Analytic profile/template/goal tests, seeded byte-deterministic generator, wet/fired and target browser journeys | Physical overlay alignment screenshots and pottery/vision reviewer decisions |
| 4 Wobble | Bounded contour buffer, camera-motion/period/oscillation/classification pipeline, worker integration, two-window persistence, reactive visible-stability UI, seeded 50-condition generator | Wobble unit corpus and independent gate-failure summarizer tests | Dial-indicator rig, consented real clips, phone throughput, independent labels, Gate 3 signature; proactive flag remains off |
| 5 Realtime voice | Auth/CSRF/rate-limited same-origin endpoint, server-only provider configuration/tool injection, provider-neutral WebRTC and mock transports, reconnect lifecycle, VAD/barge-in controls, transcript consent, allow-listed evidence tools | Endpoint secret/config/error tests, transport/controller/control/tool tests, mock browser journey, latency/cost summarizer and immutable mock artifacts | Paid provider/account comparison, real phone audio/noise/network traces, retention/ZDR/region/subprocessor audit, Gate 4 signature; cloud flag remains off |
| 6 Coaching | Conservative phase state, versioned disabled-until-approved policies, priority/cooldown arbiter, approved-only local audio, grounded formatter/claim validator, session-level proactive shutdown on violation | 64-scenario mock corpus, adversarial claim tests, independent trust-invariant summarizer tests | Two-instructor blind cue review and signed domain/trust checkpoint; proactive catalog remains disabled |
| 7 Session review | IndexedDB repository/migration, bounded downsampled recorder with ephemeral quota fallback, paged timeline, gap-preserving chart/table, marked moments, evidence summaries/exports, 30-day expiry, real cache/queue/local deletion inventory and downloadable receipt | Fake-IDB, recorder, migration, review component, summary/export, retention/deletion tests plus end/review/delete browser journeys | Phone storage/network inspection and privacy reviewer signature |
| 8 Integrated prototype | Persistent non-sensitive routed lifecycle, explicit notice/audio choice, independent degradation, integrated demo fixtures through public UI, adaptive 10→7.5→5 Hz processing with 640×360 floor, CSP/permissions policy, deployment/runbook/release manifest | Desktop Chromium, Pixel-class Chromium, and iPhone-class WebKit browser journeys; axe/narrow/zoom/orientation/offline/background/network/privacy/memory checks; deterministic 20-minute model benchmark | HTTPS staging credentials/deployment, two real sessions per phone, poor-network/background/orientation traces, an actual 20-minute browser soak, multi-reviewer signed release manifest; no release tag yet |
| 9 Field hardening | Preregistered protocol, separate product/media consents, data dictionary/schema, device/studio matrices, incident plan, cluster-bootstrap summarizer, accessibility/privacy/native assessments, exact retain-research-prototype decision | Schema/summary tests, manifest/link verifier, desktop/mobile-emulation accessibility/privacy/resilience suite | Ethics/privacy approval, populated device/studio matrix, two instructors, 10 novices, VoiceOver/TalkBack, provider account audit, final multidisciplinary signature |

## Automated verification contract

Run:

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm e2e
pnpm benchmark:tags
pnpm benchmark:profile
pnpm benchmark:voice
pnpm benchmark:coaching
pnpm benchmark:integrated -- --duration=1200
pnpm benchmark:verify-manifests
node scripts/verify-calibration-board.mjs
```

The dimension, segmentation, and wobble runners create immutable synthetic JSONL evidence but never pass their physical gates. Run them explicitly when regenerating synthetic artifacts. Strict field completion is checked with `node scripts/validate-field-manifests.mjs --require-complete` and is expected to fail until the consolidated study is populated.

## Fail-closed release posture

The release manifest is unsigned and sets numeric production measurement, proactive wobble, cloud voice, and claimed mobile support to false. Demo mode is deterministic and visibly scoped to test evidence. `prototype-v1-rc1` must not be tagged until the linked physical, provider, privacy, accessibility, performance, architecture, and instructor artifacts are attached and the manifest is signed.
