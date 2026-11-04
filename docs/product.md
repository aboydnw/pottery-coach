# Pottery Coach product guide

This is a short map of the existing product contracts, not a replacement specification or a new roadmap. Baseline: `main` at `39e0f2b`, reviewed 2026-11-04. Open PRs are identified separately below.

## Purpose and scope

Help a beginning thrower who knows basic wheel operation practice with wet hands off the screen. One rigidly mounted camera observes the visible outer silhouette of one wheel-thrown cylinder. The coach supports a cylinder or curated-template goal, sparse evidence-backed feedback, and a useful session review. Instructors and research operators review advice and evidence; the product does not replace an instructor.

The [V1 contract](specs/pottery-coach-v1-product-spec.md) and [scope assumptions](research/01-product-scope-and-assumptions.md) limit claims to visible outer geometry under controlled conditions. Internal centering, wall/floor thickness, pressure, moisture, material state, collapse prediction, arbitrary viewpoints, and safety supervision are out of scope. Angled-camera geometry remains experimental, not validated real-world accuracy.

## Current prototype and journey

- **Enter and start:** Cloudflare Access protects the deployed app. Home offers Start Session and retained session history; About holds operation, privacy, and safety information. One clean-hand start action begins the hands-free workflow, with touch alternatives.
- **Set up:** Current `main` starts with an empty wheel, remembers wheel/bat diameter, and reacquires the full rim and view pose each session. Manual correction cannot override hard framing or pose failures. The printed board is an independent calibration fallback; shape-only operation is available when metric calibration is unavailable. See the [calibration contract](specs/camera-calibration-spec.md) and [approved angled-camera design](superpowers/specs/2026-10-23-angled-camera-wheel-calibration-design.md).
- **Practice:** The local camera pipeline supplies readings, target comparisons, and visible-stability evidence. Optional configured cloud voice uses evidence tools for questions. Weak, occluded, or stale evidence must yield an explicit limitation rather than a confident claim. Loss of cloud voice must not stop the local session.
- **Finish and revisit:** Review retained measurements, confidence gaps, events, and piece notes. Starting another session or going Home preserves history; deleting a session is separate and confirmed. Detailed local reviews expire after 30 days. The account-synced throw log and lasting notes are distinct from detailed local reviews; do not imply that it restores expired detail. See the [history design](superpowers/specs/2026-10-24-session-history-home-design.md) and [deployment/data flows](../deploy/config.md).

Implementation is not the same as availability or validation. [README](../README.md) explicitly lists transcript storage, the separate coaching engine, session export, and other modules that are not yet wired into the app. Their contracts describe intended capabilities, not proof of an accessible end-to-end feature.

## Release posture and success criteria

This remains a controlled research prototype. The [manifest](../src/release/manifest.ts) is pending signature and its measurement, proactive-wobble, cloud-voice, and mobile-support flags are false. However, [field-test build overrides](../src/app/featureFlags.ts) and [deployment configuration](../deploy/config.md) can expose unverified measurements and configured cloud voice. Those overrides do not close a gate or establish supported-device claims.

Existing acceptance requires a novice to complete setup, a cylinder session, a spoken measurement query, barge-in, and review; claims must trace to fresh eligible evidence. The current [V1 contract](specs/pottery-coach-v1-product-spec.md) requires relevant confidence at least 0.75, overall confidence at least 0.80, answers no older than 750 ms, proactive readings no older than 500 ms, and measurement error p95 at most 10 mm. These are acceptance requirements, not achieved field results.

The [gate ledger](research/10-benchmark-results.md) and [release checklist](release-checklist.md) track physical accuracy, real-phone endurance, provider latency/privacy, instructor review, accessibility, and field evidence. Synthetic tests, browser emulation, mock voice, and standalone modules cannot pass physical, provider, or human gates. Preserve honest uncertainty and silence over unsupported advice; see the [coaching policy](coaching-policy.md).

## Intended next direction

Product direction confirmed 2026-11-04: test printed markers as the primary calibration approach, with the longer-term goal of training a model well enough to work without markers. [PR #18](https://github.com/aboydnw/pottery-coach/pull/18) proposes the marker-first workflow, wheel-head fallback, and reviewed local clay examples, but is unmerged and does not bundle trained production weights. Marker-free operation is a future goal, not a current capability or an approved accuracy claim. [PR #17](https://github.com/aboydnw/pottery-coach/pull/17) separately proposes stronger wheel-head detection.

## Data and trust

Camera frames are processed on-device; ordinary sessions do not upload raw video. The confirmed voice direction is to send microphone audio to OpenAI with user consent. On-device voice is a possible future exploration; feasibility has not been established. Follow the [privacy notice](privacy-notice.md) and [session-data contract](session-data.md) for consent, optional transcript/still handling, retention, and deletion. Do not claim provider-side deletion without a supported route. CONTRIBUTING's blanket local-audio wording predates this clarification and conflicts with the current voice notice and deployment flow. Do not describe consented cloud voice as local-only; preserve the requirement for privacy review before changing media storage or transmission.

## Decisions still to clarify

- Accuracy direction confirmed 2026-11-04: choose a feasible target from measured evidence rather than a fixed user preference. PR #18 uses 12.7 mm p95 for known forms, while the current V1 contract and gate ledger use 10 mm. The final target remains open pending evidence; changing the existing gate requires an explicit documented decision, not this summary.
- The V1 reference journey includes local images/manual tracing, while [open questions](research/12-open-questions.md) place arbitrary reference images after V1. Keep curated templates as the established scope and clarify before promising general image import.

## Reading the source documents

Use [specifications](specs/) for product/subsystem contracts, current code and tests for implemented behavior, and the gate ledger for evidence. The original [plans](plans/) and [2026-10-09 audit](implementation-audit.md) are historical implementation records. Later [designs](superpowers/specs/) document subsequent changes; check their status and whether the corresponding work landed. Unresolved conflicts require a decision, not an assumption that every document describes the same release.
