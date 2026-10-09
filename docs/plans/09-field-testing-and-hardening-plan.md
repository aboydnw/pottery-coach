# Field Testing and Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline, task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate the controlled prototype with devices, studio conditions, novices, and instructors; harden accessibility/privacy; and decide field release versus narrower scope/native migration.

**Architecture:** A preregistered protocol freezes code/config before a locked field corpus. Structured observation and participant consent feed issue triage; only threshold/rule changes with replayable regression fixtures enter the candidate. Final support and feature flags derive from evidence.

**Tech Stack:** Existing benchmark schemas/runners; Playwright/axe `~4.10.3`; no participant recordings without separate research consent.

## Global Constraints

- Ethics/privacy review and informed consent precede recruitment.
- At least two experienced wheel instructors independently review every enabled proactive cue.
- Participant/clip is the analysis unit; report failures, abstentions, exclusions, and confidence intervals.
- No threshold is tuned on the locked field set.

---

### Task 1: Preregister field matrix and consent

**Files:** Create `research/field/protocol.md`, `consent-product.md`, `consent-media.md`, `data-dictionary.md`, `manifest.schema.json`, `analysis-plan.md`, `incident-plan.md`; modify privacy notice/provider manifest.

- [ ] Write schema tests requiring participant pseudonym, device/OS/browser, studio/light/backdrop/clay/wetness, mount geometry, completion/rescue, setup time, calibration retries, metric IDs, distraction/understanding, bystander notice, consent revisions, and deletion date.
- [ ] Run schema test; expect missing manifest.
- [ ] Draft plain-language separate product/media consents, withdrawal/deletion process, stop criteria, compensation/contact fields, and preregister thresholds/splits/exclusions/bootstrap analysis.
- [ ] Privacy/ethics checkpoint signs protocol before any data. Commit `docs: preregister pottery coach field study`.

### Task 2: Device/studio/instructor validation

**Files:** Create `research/field/device-matrix.json`, `studio-matrix.json`, `instructor-review.csv`, `scripts/validate-field-manifests.mjs`; modify cue approvals and gate records.

- [ ] Populate matrix before sessions: >=2 recent iPhone classes, >=2 recent Android classes, desktop control; diffuse/side/shadow/brightness change; four clay colors; wet/dry; three backdrops; hands/tools/sponge/clutter; wheel directions where available.
- [ ] Run manifest validator; expect no missing cells or consent references.
- [ ] Two instructors blind-rate each enabled cue on 8–12 representative clips for correctness, actionability, timing, possible damage, uncertainty, distraction; record approve/conditional/reject and disagreements.
- [ ] Disable rejected/disputed cues or encode approved condition and replay all coaching benchmarks. Expected zero trust violations.
- [ ] Commit `test: record device studio and instructor validation`.

### Task 3: Novice end-to-end study

**Files:** Create `research/field/session-form.json`, `scripts/summarize-field.mjs`, `.test.ts`, `research/field/results.md`; modify benchmark results/open questions.

- [ ] Write summarizer tests for completion/rescue, median setup time, failure reasons, spoken-query success, barge-in success, uncertainty comprehension, distraction 1–5, bystander compliance, deletion success, and participant-cluster bootstrap intervals.
- [ ] Freeze release manifest; recruit first cohort of 10 novices who meet safety/instruction prerequisites; observe without rescue unless safety/protocol requires; collect structured data, not default raw media.
- [ ] Run summary. Field gate starting threshold: >=80% unassisted full-flow completion and >=80% correctly explain visual-only uncertainty; report setup time/distraction without post-hoc pass threshold; zero privacy/trust critical incidents.
- [ ] Convert every software failure to a minimal replay fixture, fix test-first, rerun full automated suite, and use a new cohort for changed UX/threshold claims.
- [ ] Commit `test: evaluate novice end-to-end task success`.

### Task 4: Accessibility, privacy, and resilience audit

**Files:** Create `tests/e2e/accessibility.spec.ts`, `privacy-field.spec.ts`, `resilience.spec.ts`, `docs/accessibility.md`, `research/field/privacy-audit.md`.

- [ ] Write axe/keyboard/reduced-motion/zoom/caption/non-color/44px target tests; privacy tests for tracks on pause/end/revoke, network payload, retention expiry/delete inventory; resilience tests for permission revoke, offline, provider 429/5xx, quota, background, orientation, camera ended.
- [ ] Run tests; expect any audit failures to block field release.
- [ ] Fix each defect with its failing regression test; manually test VoiceOver iPhone and TalkBack Android for setup/live/end critical path.
- [ ] Privacy reviewer performs DPIA-style data-flow/config audit and bystander procedure observation. Provider account retention/ZDR/region/subprocessors are verified, not inferred.
- [ ] Commit `fix: harden accessibility privacy and resilience`.

### Task 5: Final decision and native assessment

**Files:** Create `docs/reviews/field-release-review.md`, `docs/native-migration-assessment.md`; update executive summary, support matrix, risk register, benchmark/gate ledger, release checklist.

- [ ] Convene product, vision, architecture, instructor, privacy, accessibility reviewers. Map every acceptance criterion to evidence and every residual critical/high risk to owner/trigger/fallback.
- [ ] Choose exactly one: proceed to field prototype; proceed with narrower devices/conditions/features; retain research prototype; stop. Never convert a missing gate into acceptance.
- [ ] Recommend native investigation if two supported iPhones fail integrated runs, background/audio interruption >5%, required focus/exposure controls unavailable, thermal rate <5 Hz, or locked-screen/background coaching becomes required.
- [ ] Run full verification command: `pnpm test && pnpm typecheck && pnpm build && pnpm playwright test && pnpm benchmark:verify-manifests`; expect all green and all gate links resolvable.
- [ ] Final review checkpoint signs decision. Commit `docs: record pottery coach prototype release decision`.

## Rollback/fallback

Critical privacy/safety incident stops sessions, disables cloud/proactive features, preserves only consented diagnostic evidence, triggers deletion/notification protocol, and requires fresh review. Poor results narrow conditions/features; they never justify hidden threshold relaxation. Native migration reuses specs/corpora/interfaces rather than forking claim policy.

## Documentation requirements

Publish de-identified aggregate results, supported devices/conditions, instructor approval table, accessibility statement, privacy audit, incidents/remediations, residual risks, final recommendation, and native trigger decision.
