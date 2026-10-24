# Session History Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline, task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a concise history-first home, protected About view, and top-of-review actions that let users start again without deleting their completed session.

**Architecture:** Extend the existing reducer with explicit navigation and reset events, while keeping browser-history synchronization inside `SessionFlow`. Add focused Home, About, review-action, and history-loading modules so repository access and presentation remain independently testable.

**Tech Stack:** React 19, TypeScript, Dexie/IndexedDB, Vitest and Testing Library, Vite, Cloudflare Workers/Access.

## Global Constraints

- Cloudflare Access remains the only authentication layer and protects the whole hostname.
- Starting a new session must preserve all completed-session data.
- Detailed session history remains subject to the existing 30-day local retention policy.
- Production changes follow red-green-refactor test-driven development.
- Do not add a routing dependency.

---

### Task 1: Separate lifecycle navigation from deletion

**Files:**

- Modify: `src/app/AppSessionOrchestrator.ts`
- Test: `src/app/AppSessionOrchestrator.test.ts`

**Interfaces:**

- Produces: explicit `GO_HOME`, `SHOW_ABOUT`, `OPEN_REVIEW`, and `START_NEW_SESSION` events and `home | about | live | review` steps.

- [x] Write reducer tests proving review-to-live preserves the lifecycle independently of deletion, review-to-home works, About can open and close, and review restoration carries a selected session ID.
- [x] Run `pnpm test src/app/AppSessionOrchestrator.test.ts` and confirm the new assertions fail because the events and state do not exist.
- [x] Implement the minimal event and state changes, keeping reload restoration safe by returning Home.
- [x] Run `pnpm test src/app/AppSessionOrchestrator.test.ts` and confirm all lifecycle tests pass.

### Task 2: Build retained-session history data

**Files:**

- Create: `src/history/sessionHistory.ts`
- Create: `src/history/sessionHistory.test.ts`
- Create: `src/history/SessionHistory.tsx`
- Create: `src/history/SessionHistory.test.tsx`

**Interfaces:**

- Consumes: `SessionRecord[]` from `SessionRepository.list()` and `PieceRecord[]` from `ThrowLog.listPieces()`.
- Produces: `buildSessionHistory(sessions, pieces): SessionHistoryItem[]` and `SessionHistory` presentation with `onOpen(sessionId)`.

- [x] Write failing unit tests for newest-first history, grouped piece counts, duration, and interrupted sessions.
- [x] Run `pnpm test src/history/sessionHistory.test.ts` and confirm failure because the module is missing.
- [x] Implement the typed history projection and rerun the unit test to green.
- [x] Write failing component tests for concise empty state, session metadata, and opening a selected review.
- [x] Run `pnpm test src/history/SessionHistory.test.tsx` and confirm failure because the component is missing.
- [x] Implement the accessible session list and rerun both history test files to green.

### Task 3: Add Home and About views

**Files:**

- Create: `src/app/HomeScreen.tsx`
- Create: `src/app/HomeScreen.test.tsx`
- Create: `src/app/AboutScreen.tsx`
- Create: `src/app/AboutScreen.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**

- Home consumes `SessionHistoryItem[]`, `onStart`, `onOpenSession`, and `onAbout`.
- About consumes `voiceAvailable`, `demoMode`, `onHome`, and `onStart`.

- [x] Write failing Home tests for Start Session appearing first, About navigation, and past-session rendering.
- [x] Run `pnpm test src/app/HomeScreen.test.tsx` and verify the component-missing failure.
- [x] Implement the concise Home screen and styles, then rerun its test to green.
- [x] Write failing About tests for the moved empty-wheel, camera/privacy, safety, voice, storage, Home, and Start content/actions.
- [x] Run `pnpm test src/app/AboutScreen.test.tsx` and verify the component-missing failure.
- [x] Implement About and rerun both screen tests to green.

### Task 4: Replace the bottom deletion flow with top review actions

**Files:**

- Replace: `src/privacy/DeleteSessionDialog.tsx` with `src/review/ReviewActions.tsx`
- Replace test coverage: `src/privacy/DeleteSessionDialog.test.tsx` with `src/review/ReviewActions.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**

- Produces: `ReviewActions` with `onStartNew`, `onDelete`, and `onHome`; `onDelete` resolves to a `DeletionReceipt`.

- [x] Write failing component tests proving action order, inline confirmation/cancellation, disabled pending state, successful deletion callback, and receipt availability.
- [x] Run `pnpm test src/review/ReviewActions.test.tsx` and verify failure because the component is missing.
- [x] Implement the compact action group, retaining receipt download support without a layout-shifting second workflow.
- [x] Run `pnpm test src/review/ReviewActions.test.tsx` and confirm it passes.

### Task 5: Integrate history, navigation, loading, and selected-session deletion

**Files:**

- Modify: `src/app/SessionFlow.tsx`
- Modify: `src/app/SessionFlow.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**

- Consumes all modules from Tasks 1-4.
- Produces browser-history-aware Home/About/Live/Review workflow and selected-session deletion.

- [x] Expand `SessionFlow` tests with injected repositories/services or module-level test seams proving initial history load, history review loading, Start New Session without deletion, Home navigation, About navigation, and selected-session deletion.
- [x] Run `pnpm test src/app/SessionFlow.test.tsx` and confirm the new workflow assertions fail against the old screen.
- [x] Refactor `SessionFlow` to load history, load a selected bundle, reset transient state independently, synchronize URLs, handle `popstate`, and render the new focused components.
- [x] Run `pnpm test src/app/SessionFlow.test.tsx` plus the focused tests from Tasks 1-4 and confirm they pass.
- [x] Remove obsolete deletion-dialog files and imports after equivalent receipt behavior is covered.

### Task 6: Verify, document, and update PR #14

**Files:**

- Modify: `docs/superpowers/plans/2026-10-24-session-history-home.md` (check completed steps)
- Modify: `docs/superpowers/specs/2026-10-24-session-history-home-design.md` only if implementation discoveries require an accurate clarification.

**Interfaces:**

- Produces: reviewed commit pushed to the existing `feat/live-wheel-overlay` branch and visible on PR #14.

- [x] Run focused tests and inspect the mobile action layout with the existing browser test harness.
- [x] Run `pnpm verify` and retain the complete exit status.
- [x] Review the diff against every approved design requirement and correct any gap with a failing regression test first.
- [x] Commit the implementation and planning documents with a scoped message.
- [x] Push `feat/live-wheel-overlay`, confirm PR #14 contains the commit, and monitor `gh pr checks 14` through completion or a diagnosed external failure.
