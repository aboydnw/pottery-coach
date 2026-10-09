# Coaching Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline, task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic evidence-bearing rules, conservative phase context, cue priority/cooldown/suppression, LLM phrasing boundaries, and a complete audit trail.

**Architecture:** Observation events feed pure rule evaluators. `PhaseMachine` uses user declarations first. `CueArbiter` decides speak/suppress independently of the cloud; the transport verbalizes only immutable approved facts. Local urgent cues use pre-approved assets after Gate 3.

**Tech Stack:** Existing TypeScript/Vitest stack; XState is not required—the small explicit reducer is easier to audit; fast-check for event-sequence properties.

## Global Constraints

- Every enabled proactive policy has instructor approval ID.
- Global non-urgent cooldown 20 s; same policy 60 s; encouragement 180 s.
- Quantitative facts preserve evidence IDs and eligibility; the model cannot introduce numbers/causes.
- Low confidence proactive behavior is silence.

---

### Task 1: Session and phase state

**Files:** Create `src/coaching/types.ts`, `PhaseMachine.ts`, `.test.ts`, `SessionState.ts`, `.test.ts`.

**Interfaces:** Exact `ThrowingPhase`, `PhaseEvidence`; `PhaseMachine.reduce(event):PhaseEvidence`; events `user-declared|shape-corroboration|contradiction|expired|session-ended`.

- [ ] Write transition tests: setup→user-declared phase; shape evidence alone cannot authorize centering/opening advice; contradictions/expiry→uncertain; no automatic backward transition except uncertain; session end terminal.
- [ ] Run tests; expect modules absent.
- [ ] Implement pure reducers with injected clock and audit event on every transition.
- [ ] Run unit/property tests over random sequences; expect no forbidden transition or expired confident phase.
- [ ] Commit `feat: add conservative throwing phase state`.

### Task 2: Versioned policy catalog and rules

**Files:** Create `src/coaching/policies/*.json` for required V1 policies, `policySchema.ts`, `.test.ts`, `evaluatePolicies.ts`, `.test.ts`; create `docs/coaching-policy-review.csv`.

**Interfaces:** Exact `CuePolicy`/`CueCandidate`; `evaluatePolicies(observation,state,now):CueCandidate[]`.

- [ ] Write schema tests requiring every trigger/confidence/freshness/persistence/priority/cooldown/suppression/example/prohibited/audit/approval field; unapproved proactive policy must load disabled.
- [ ] Write evaluation tests for current dimensions, target deviation/milestone, measurement unavailable, wobble flag, and pause/resume/end with boundary values.
- [ ] Run tests; expect missing catalog/evaluator.
- [ ] Implement catalog/evaluators as pure functions. Use `instructorApprovalId:null` for all proactive cues until Plan 9 review; reactive questions remain available with eligibility checks.
- [ ] Run tests; expect no unapproved proactive candidate.
- [ ] Commit `feat: define evidence-based coaching policies`.

### Task 3: Arbiter, interruption, local cues

**Files:** Create `src/coaching/CueArbiter.ts`, `.test.ts`, `src/coaching/LocalCuePlayer.ts`, `.test.ts`, `public/audio/manifest.json` (empty until approved), modify voice controller.

**Interfaces:** `consider(candidates,context):{speak:CueCandidate|null;suppressed:Array<{cue;reason}>}`; `markSpoken`, `cancel`; priority order exact from spec.

- [ ] Write fake-clock tests for priority, direct-question preemption, only priority 1 interruption, expirations, global/same/encouragement cooldowns, duplicate evidence, active shaping/occlusion/voice-user-speaking suppression.
- [ ] Run tests; expect failures.
- [ ] Implement arbiter with stable reason codes/audit emissions and local cue player that refuses missing/unapproved manifest entries.
- [ ] Run tests; expect no repeated cue within cooldown and no unapproved audio.
- [ ] Commit `feat: arbitrate restrained coaching cues`.

### Task 4: Grounded phrasing and claim validator

**Files:** Create `src/coaching/formatCueFacts.ts`, `.test.ts`, `src/coaching/ClaimValidator.ts`, `.test.ts`, `src/coaching/prohibited-language.json`, modify realtime instructions.

**Interfaces:** `formatCueFacts(candidate):ApprovedUtteranceInput`; `validateSpokenClaim(transcript,cue,toolResults):ClaimValidation` matching numeric tokens (with rounding tolerance) and prohibited concepts.

- [ ] Write tests for mm/cm conversions, uncertainty rounding, stale/missing evidence, invented numbers, causal language, thickness/pressure/moisture/internal/perfect-center/collapse claims, and permitted “visually centered from this view.”
- [ ] Run tests; expect missing validator.
- [ ] Implement deterministic formatter for local cues and offline validator/audit flag for cloud transcripts. Validator never silently rewrites a harmful output; it records violation and disables proactive cloud speech for the session.
- [ ] Run tests; expect adversarial corpus violations detected and valid phrases accepted.
- [ ] Commit `feat: enforce grounded coaching language`.

### Task 5: Benchmark 6 and domain checkpoint

**Files:** Create `benchmarks/coaching/scenarios/*.json`, `run.ts`, `summarize.ts`, schema; modify benchmark results and policy review CSV.

- [ ] Write summarizer tests failing independently on invented measurement, low-confidence/stale proactive claim, cooldown duplicate, phase conflict, unsupported advice, excess cues/minute.
- [ ] Implement >=50 deterministic scenarios including occlusion, reconnect, contradictory phase, noisy wobble, repeated questions, long silence, and adversarial model text.
- [ ] Run mock transport benchmark; required automated result: zero invented/stale/low-confidence/duplicate/prohibited claims. Record unprompted cues/minute rather than imposing an unvalidated comfort threshold.
- [ ] Have two experienced instructors independently review 8–12 representative clips per proactive cue and mark approve/conditional/reject. Enable only approvals; resolve disagreement by disabling or narrowing.
- [ ] Browser acceptance: hands-free scripted session on supported phones; local urgent cue start <=500 ms where enabled; direct questions remain interruptible.
- [ ] Review checkpoint: domain and trust reviewers sign. Commit `test: validate coaching restraint and approvals`.

## Rollback/fallback

One switch disables all proactive speech while retaining reactive tool answers. Disable cloud phrasing after a claim violation and use deterministic local templates. A disputed cue remains disabled. Wobble cue remains absent if Gate 3 failed.

## Documentation requirements

Publish policy catalog/revisions, approval records, thresholds, cooldown rationale, prohibited language, benchmark corpus/results, incident behavior, and user-facing uncertainty wording.
