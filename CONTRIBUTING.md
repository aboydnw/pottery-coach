# Contributing

Thanks for helping with Pottery Coach. It's a small research prototype, so the process is light, but a few habits keep it trustworthy.

## Setup

Use Node 24 and pnpm 10, then run `pnpm install`. `pnpm verify` runs every check that CI runs. Playwright needs browsers the first time, so run `pnpm exec playwright install --with-deps chromium webkit`.

## Making a change

1. Branch from `main` and open a pull request. PRs are squash-merged, so you don't need to tidy individual commits.
2. Write commit messages and PR titles as [Conventional Commits](https://www.conventionalcommits.org/), for example `fix(vision): …` or `docs: …`.
3. Add or update tests with the change. Name a test after the behaviour it checks, and don't assert on error message text.
4. Run `pnpm format`, `pnpm lint`, `pnpm typecheck` and `pnpm test` before pushing. If you touched the camera, workers or calibration, also run `pnpm e2e`. Those paths only fail in a real browser.

## Ground rules

- **Raw camera frames and audio stay on the device.** Anything that would store or send them needs a privacy review, and `tests/e2e/network-boundary.spec.ts` and `privacy-field.spec.ts` must keep passing.
- **Don't overstate evidence.** Synthetic or mock results must be labelled as such, and they never pass a gate in `docs/research/10-benchmark-results.md`. If a benchmark can't measure something yet, make it say so rather than emit plausible numbers.
- **Don't weaken the release gates.** Feature flags come from `src/release/manifest.ts`. Only a documented gate decision should change them.
- **Keep demo shortcuts out of production.** Anything behind `?mode=demo` must stay behind `DEMO_AVAILABLE`.

## Code style

- Prefer small, pure modules with tests next to them (`thing.ts` and `thing.test.ts`).
- Add a docstring to exported functions and classes that aren't obvious from their names. Skip comments that narrate what the code does.
- Shared helpers live in `src/shared/`. Check there before writing another `median`.
- Unit tests run in Node by default. Component tests (`*.test.tsx`) get jsdom automatically, and other files that need the DOM opt in with `// @vitest-environment jsdom`.

## Reporting problems

Open a GitHub issue with what you did, what you expected, and the browser and device. For camera problems, attach the file from **Download diagnostics**. Don't attach photos or video of people.
