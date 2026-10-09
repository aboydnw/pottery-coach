# Session Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline, task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist bounded structured sessions, show truthful timelines/graphs/moments/summaries, export them, expire them, and produce verifiable deletion receipts.

**Architecture:** A versioned IndexedDB repository stores downsampled readings and events; blobs are isolated. Summary derivation is pure and never infers across confidence gaps. Retention/deletion is local-first with an optional backend adapter.

**Tech Stack:** Existing stack; Dexie `~4.2.1`; fake-indexeddb `~6.2.2`; native SVG; Zod.

## Global Constraints

- No raw continuous video/audio storage. Stable readings max 2 Hz; diagnostics max 1 Hz.
- Transcript/still retention follows separate consent flags.
- Default structured retention 30 days; deletion is idempotent and inventory-based.

---

### Task 1: Versioned repository and bounded recorder

**Files:** Create `src/session/types.ts`, `SessionRepository.ts`, `.test.ts`, `SessionRecorder.ts`, `.test.ts`, `migrations.ts`, `.test.ts`.

**Interfaces:** Exact `SessionRecord`, `SessionEvent`, `MarkedMoment`, `DeletionReceipt`; repository `create`, `appendReading`, `appendEvent`, `markMoment`, `get`, `list`, `delete`, `expire`.

- [ ] Write fake-IDB tests for schema v1, 2/1 Hz downsampling, transaction rollback, quota failure, no raw media field, transcript/still consent enforcement, and migration of a seeded pre-v1 record.
- [ ] Run tests; expect modules missing.
- [ ] Implement Dexie tables/indexes, recorder with bounded write queue of 100 (drop diagnostic before evidence), and storage-unavailable disclosure event.
- [ ] Run tests; expect deterministic records and no unbounded queue.
- [ ] Commit `feat: persist bounded structured sessions`.

### Task 2: Timeline, graphs, and moments

**Files:** Create `src/review/SessionReview.tsx`, `.test.tsx`, `Timeline.tsx`, `.test.tsx`, `MeasurementChart.tsx`, `.test.tsx`, `MarkedMoments.tsx`, `.test.tsx`, `tests/e2e/session-review.spec.ts`.

**Interfaces:** UI consumes repository DTOs only; chart gaps on null/low-confidence and links points/events by evidence ID.

- [ ] Write tests for empty/failed/completed sessions, confidence gaps, stale periods, cue suppression entries, selected moment with/without local still, keyboard navigation, accessible chart table, and no causal labels.
- [ ] Run tests; expect absent components.
- [ ] Implement virtualized timeline if >500 events, native SVG charts plus table, limitation copy, local-only still indicator, and event filters.
- [ ] Run unit/E2E and desktop visual snapshots; expect gaps preserved and all events navigable without pointer.
- [ ] Commit `feat: add evidence-linked session review`.

### Task 3: Summary and export

**Files:** Create `src/review/buildSummary.ts`, `.test.ts`, `src/review/exportSession.ts`, `.test.ts`, `src/review/summarySchema.ts`.

**Interfaces:** `buildSummary(record,readings,events):SessionSummary`; `exportJson`, `exportCsvReadings`; every summary claim includes evidence IDs.

- [ ] Write tests for peak/final dimensions, milestone timing, unmeasurable duration, no interpolation, no transcript case, escaped CSV formula cells, stable JSON schema, and unsupported claim absence.
- [ ] Run tests; expect missing modules.
- [ ] Implement deterministic structured summary; optional LLM prose may only paraphrase the summary schema and must pass ClaimValidator before display.
- [ ] Run tests and validate exported fixtures; expect byte-stable JSON for fixed clocks.
- [ ] Commit `feat: summarize and export session evidence`.

### Task 4: Retention, deletion, and privacy acceptance

**Files:** Create `src/privacy/RetentionService.ts`, `.test.ts`, `src/privacy/DeletionService.ts`, `.test.ts`, `src/privacy/DeleteSessionDialog.tsx`, `.test.tsx`, `tests/e2e/privacy-controls.spec.ts`, `docs/deletion-inventory.md`.

**Interfaces:** `deleteSession(id):Promise<DeletionReceipt>` inventories `indexeddb`, `cache-storage`, `local-blobs`, `sync-queue`, `backend`, `provider-exception`.

- [ ] Write tests for 30-day expiry boundary, active-session exclusion, idempotence, partial backend failure/retry, all store inventory, and receipt display without claiming provider deletion when unavailable.
- [ ] Run tests; expect missing services.
- [ ] Implement startup/end expiry, explicit confirmation, track shutdown before delete, cache/queue cleanup, backend adapter, and downloadable receipt.
- [ ] Run full tests/E2E. Use browser devtools storage/network on iPhone/Android proxies or remote inspection: raw video/audio absent, transcript/still follow toggles, delete removes inventory.
- [ ] Review checkpoint: privacy reviewer signs retention/data-flow inventory. Update user privacy notice and commit `feat: add retention and verifiable deletion`.

## Rollback/fallback

On IDB/quota failure continue live ephemerally and disclose before start. Disable stills independently. If backend deletion is unavailable, do not add backend persistence. A summary validator failure shows structured evidence only.

## Documentation requirements

Document schemas/migrations, storage limits, summary semantics, export format, retention, deletion inventory/exceptions, and privacy acceptance artifacts.
