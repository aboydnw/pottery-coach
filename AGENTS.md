# Repository guide

## Start here

- Read [README.md](README.md) for setup and the implementation map, [docs/product.md](docs/product.md) for product scope and unresolved decisions, and [CONTRIBUTING.md](CONTRIBUTING.md) for contribution rules. This guide supplements those documents.
- Consult the relevant [subsystem specification](docs/specs/) before changing behavior. Check current code and tests for what is actually connected to the app.
- Treat [original plans](docs/plans/) and the dated [implementation audit](docs/implementation-audit.md) as historical evidence, not a current completion checklist. Read later designs in [docs/superpowers/specs/](docs/superpowers/specs/) and their status. An open PR is proposed work, not shipped behavior.
- If sources disagree on intended behavior, flag the conflict and ask rather than inventing a product decision. Keep this guide and the product overview concise; put detailed contracts in their existing documents.

## Work and verify

- Use Node 24 and the pnpm 10 version pinned in [package.json](package.json). Install with `pnpm install --frozen-lockfile`; start locally with `pnpm dev`.
- Branch from `main`; use Conventional Commit messages and PR titles. Keep changes focused and add behavior-named tests beside the modules they cover. Prefer small pure modules and existing helpers in `src/shared/`.
- Before pushing, run `pnpm format`, `pnpm lint`, `pnpm typecheck`, and `pnpm test`. Camera, worker, or calibration changes also require `pnpm e2e`. Install Playwright's Chromium and WebKit browsers as described in CONTRIBUTING.
- `pnpm verify` runs lint, formatting, unit tests, type checks, build, browser tests, and evidence-manifest checks. [CI](.github/workflows/ci.yml) additionally validates the Worker dry-run and production-preview camera journeys. Report checks that failed or were not run; do not call a partial run a full pass.
- If `src/calibration/boardV1.ts` changes, regenerate the printable board with `pnpm calibration:board` and keep its verification test passing. Run the relevant benchmark when changing its measured behavior.
- Pushes to `main` deploy through Workers Builds. See [deployment instructions](deploy/config.md); do not treat opening a PR as permission to merge or deploy.

## Preserve the trust boundaries

- Keep camera processing local and continuous raw media out of session storage. Cloud microphone audio requires user consent; see the product guide for the clarified OpenAI direction. Follow the [privacy notice](docs/privacy-notice.md), consent boundaries, and contribution requirement for privacy review before changing media storage or transmission. Keep the network-boundary and privacy browser tests passing; never put provider secrets in the client.
- Preserve confidence, freshness, calibration, and evidence-ID checks. Missing or ineligible readings stay missing; do not fill chart gaps, invent dimensions, or infer internal clay properties.
- Preserve the [coaching policy](docs/coaching-policy.md): weak evidence suppresses proactive cues, and instructor approval is required for proactive policies.
- Do not weaken the [release manifest](src/release/manifest.ts) or [gate ledger](docs/research/10-benchmark-results.md). Synthetic, mock, emulated, and physical evidence must remain distinct. Field-test overrides in [featureFlags.ts](src/app/featureFlags.ts) do not pass release gates.
- Keep demo shortcuts behind `DEMO_AVAILABLE`. Preserve local continuity when cloud voice fails, accessible touch alternatives, explicit interruption recovery, and session deletion/retention behavior.

## Where to look

- Session lifecycle and navigation: `src/app/`; live UI and setup: `src/live/`, `src/setup/`.
- Camera and geometry: `src/camera/`, `src/calibration/`, `src/vision/`, `src/measurement/`, `src/wobble/`.
- Voice transport and evidence tools: `src/voice/`; separate coaching policies: `src/coaching/`.
- Detailed local sessions and review: `src/session/`, `src/review/`, `src/privacy/`; throw log and sync: `src/pieces/`, `src/sync/`, `worker/`.
- Before wiring an existing module into the product, check README's **Built but not yet wired into the app** list. Tests for a standalone module do not establish a working user journey.
