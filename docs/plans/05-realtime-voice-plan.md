# Realtime Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline, task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure mobile WebRTC conversation with VAD, barge-in, tools, transcripts, reconnect, usage accounting, and a mock provider.

**Architecture:** A provider-neutral `RealtimeCoachTransport` sits behind one browser state machine. A same-origin serverless endpoint performs OpenAI unified WebRTC session creation so no long-lived secret reaches the client. Measurement tools read local stores and return schema-validated facts.

**Tech Stack:** Existing stack; `openai ~6.3.0` server-side only if current official SDK supports required endpoint, otherwise audited `fetch`; Zod; MSW `~2.11.0`; Playwright. Pin the exact current realtime model in environment/config after benchmark.

## Global Constraints

- Verify current provider docs/pricing/retention on implementation date and update provider manifest.
- Browser never receives standard API key; logs redact SDP, tokens, audio, transcripts unless consented.
- Numeric answers must invoke tools; voice failure never stops local vision.

---

### Task 1: Session endpoint and secret boundary

**Files:** Create `api/realtime/session.ts`, `api/realtime/session.test.ts`, `src/voice/sessionSchema.ts`, `.test.ts`, `src/privacy/providers/openai.json`; modify deployment config and `.env.example`.

**Interfaces:** `POST /api/realtime/session` accepts `{sdp,sessionId,clientConfigVersion}` with auth/CSRF; returns SDP answer content type; server injects model, voice, instructions, tools. Errors are stable `VOICE_RATE_LIMITED|VOICE_PROVIDER_ERROR|VOICE_CONFIG_MISMATCH`.

- [ ] Write endpoint tests: unauthenticated/CSRF/rate-limit reject; client model/instructions ignored; provider Authorization server-only; SDP size/type validated; secrets absent from response/log spy.
- [ ] Run endpoint tests; expect missing route.
- [ ] Implement unified `/v1/realtime/calls` exchange with abort timeout, request ID, rate limit, allow-listed configuration, redacted logging, and provider manifest fields.
- [ ] Run tests plus secret scan `rg 'sk-[A-Za-z0-9]' . --glob '!node_modules/**'`; expect no hits.
- [ ] Commit `feat: add secure realtime session exchange`.

### Task 2: Transport and lifecycle

**Files:** Create `src/voice/types.ts`, `RealtimeCoachTransport.ts`, `OpenAIWebRtcTransport.ts`, `.test.ts`, `MockRealtimeTransport.ts`, `ConversationController.ts`, `.test.ts`.

**Interfaces:** Exact transport/state/config types from conversation spec. `RealtimeEvent` includes connected, speech-started/stopped, transcript-delta/final, tool-call, output-started/stopped, usage, error, closed.

- [ ] Write mocked RTCPeerConnection/data-channel tests for offer/answer, remote audio, connected state, idempotent close, track stop, malformed event rejection, and listener unsubscribe.
- [ ] Write state tests for reconnect delays 0/1/2/4/8 seconds, max five attempts, visibility interruption, fresh-session compact context, and no stale reading restore.
- [ ] Run tests; expect missing implementations.
- [ ] Implement WebRTC transport, audio element routing, schema validation, controller, deterministic mock, and provider usage capture.
- [ ] Run tests/typecheck; expect all lifecycle transitions deterministic with fake timers.
- [ ] Commit `feat: add provider-neutral realtime transport`.

### Task 3: VAD, barge-in, transcripts, controls

**Files:** Create `src/voice/VoiceControls.tsx`, `.test.tsx`, `src/voice/TranscriptStore.ts`, `.test.ts`, `tests/e2e/voice-mock.spec.ts`; modify session UI.

**Interfaces:** `cancelOutput("barge-in")`, `pauseInput`, `resumeInput`; transcript entries carry provider event ID, speaker, timestamps, final/partial, retention consent.

- [ ] Write tests: speech-start sends cancel/output clear, local audio stops immediately, cancellation latency measured, pause disables mic track, resume reacquires if ended, partial transcript not persisted, transcript toggle deletes stored transcript.
- [ ] Run tests; expect failures.
- [ ] Implement server VAD config, data-channel cancel/clear/truncate flow, captions, persistent cloud/mic state, visual pause/end controls, and mock E2E.
- [ ] Run unit/E2E; expect barge-in simulated latency <300 ms and pause creates no outbound mock audio events.
- [ ] Commit `feat: add interruptible voice controls`.

### Task 4: Tool registry and measurement truth

**Files:** Create `src/voice/tools/types.ts`, `registry.ts`, `.test.ts`, handlers for `setGoal`, `getCurrentDimensions`, `getWobbleStatus`, `compareTargetProfile`, `getMeasurementConfidence`, `pauseCoaching`, `resumeCoaching`, `markMoment`; create `src/voice/instructions.ts`, `.test.ts`.

**Interfaces:** Exact `CoachingFunctions` from spec; every return includes evidence ID/timestamp/confidence or explicit unmeasurable reason.

- [ ] Write contract tests for every tool, unknown/invalid calls, stale/low-confidence results, rounding, and an instruction snapshot containing prohibited untooled-number rule.
- [ ] Run tests; expect registry missing.
- [ ] Implement allow-listed handlers reading local stores; return function-call output; never let provider mutate measurements. Add adversarial mock utterance “guess my height” and assert tool call or uncertainty, never a number.
- [ ] Run tests; expect zero ungrounded numeric mock responses.
- [ ] Commit `feat: ground realtime voice in measurement tools`.

### Task 5: Provider Gate 4 and cost

**Files:** Create `benchmarks/voice/scripts.json`, `run.ts`, `summarize.ts`, schemas, `docs/voice-test-protocol.md`; modify benchmark results/provider manifest.

- [ ] Write summary tests for p50/p95 response, barge-in, tool round-trip, reconnect, provider usage/cost; failures occur when p50 >1.5 s or barge-in >300 ms.
- [ ] Implement timestamped scripted runner and 20-minute restrained/stress profiles. Run mock to validate artifacts.
- [ ] With approved paid credentials, run OpenAI and Gemini adapter/prototype comparison on supported iPhone/Android under quiet/studio-noise/poor-network profiles; record exact account/model/pricing date and cost.
- [ ] Accept Gate 4 only if continuous conversation, interruption, all tools, reconnect, and privacy configuration work; conversational start p50 <=1.5 s and barge-in <=300 ms. Report p95 and failures even if pass.
- [ ] Review checkpoint: security/privacy reviews secret/data flow; performance reviewer checks traces. Commit `test: record realtime conversation gate`.

## Rollback/fallback

Switch provider through adapter only after equivalent tests. On cloud loss use local text/approved canned cues and reconnect button. If no provider passes, ship Plan 6 with deterministic local coaching and omit open conversation. If privacy/account controls fail, block the provider.

## Documentation requirements

Document auth/session sequence, provider/account retention, models/prices/date, VAD/barge-in semantics, reconnect/expiry, transcript controls, tool schemas, degraded mode, and Gate 4 artifacts.
