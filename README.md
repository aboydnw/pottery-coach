# Pottery Coach

A hands-free practice coach for throwing pottery on the wheel. A phone or laptop camera watches the vessel from the side, measures its height and profile against a target shape, and flags visible wobble, all on the device. Raw video never leaves it. An optional voice coach answers questions such as "how tall is it?" using only measurements the camera can support.

This is a controlled research prototype, not production software or safety equipment. Every gate that needs real phones, real clay, a paid voice provider, accessibility testing with assistive technology, or a pottery instructor is still open. The release manifest keeps numeric measurement, proactive wobble alerts, cloud voice and mobile support switched off until those gates pass. Research finished on 2026-10-08; see [`docs/research/10-benchmark-results.md`](docs/research/10-benchmark-results.md) for what has and hasn't been measured.

## Quick start

You need Node 24 and pnpm 10.

```sh
pnpm install
pnpm dev
```

Open the printed URL. Camera access needs HTTPS except on `localhost`, and the app only asks for it after you click **Start camera**. To walk through the whole flow without a printed board or a pot, open `/?mode=demo`. Demo mode loads a fixed calibration and reading, and only exists in development builds (or builds made with `VITE_ENABLE_DEMO=true`).

To calibrate for real, print [`public/calibration/board-v1.svg`](public/calibration/board-v1.svg) at 100% scale and check that the reference line measures 100 mm.

## Deployment

The app runs on Cloudflare Workers at **https://potterycoach.anthonynboyd.com**, and every push to `main` deploys through Workers Builds. [`deploy/config.md`](deploy/config.md) covers setup, secrets and rollback. `pnpm deploy:dry-run` validates the bundle locally.

## Checks

| Command                  | What it does                                                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`              | oxlint (TypeScript, React hooks, accessibility, Vitest rules)                                                                                      |
| `pnpm format`            | Formats with Prettier; CI runs `pnpm format:check`                                                                                                 |
| `pnpm typecheck`         | Type-checks the app (`tsconfig.json`) and the Node code in `api/`, `benchmarks/`, `scripts/` and `tests/` (`tsconfig.node.json`)                   |
| `pnpm test`              | Vitest unit and component tests                                                                                                                    |
| `pnpm e2e`               | Playwright journeys in Chromium (fake camera), mobile Chromium and WebKit. One project feeds a rendered calibration board to the real tag detector |
| `E2E_PREVIEW=1 pnpm e2e` | The same journeys against a production build                                                                                                       |
| `pnpm verify`            | Everything above plus the build and evidence-manifest checks                                                                                       |

After changing `src/calibration/boardV1.ts`, regenerate the printable board with `pnpm calibration:board`. A unit test fails if the SVG and the definition drift apart.

## How it fits together

```text
camera ──▶ CanvasFrameSource ──▶ measurement worker ──▶ stable readings ──▶ target comparison, wobble status
 (useCamera)   (≤10 fps, 320 px)   segmentation, profile,    (temporal filter)        │
                                   wobble fit                                         ▼
                                                                         IndexedDB session ──▶ review / delete
```

- `src/app/` holds the session state machine (`AppSessionOrchestrator.ts`), the top-level flow and session recording.
- `src/camera/`, `src/vision/`, `src/measurement/` and `src/wobble/` hold the camera, the worker pipeline, dimension extraction and oscillation detection.
- `src/calibration/` holds the board definition, the AprilTag worker (vendored WebAssembly in `public/vendor/apriltag`) and the homography.
- `src/session/`, `src/privacy/` and `src/review/` hold local storage, retention and deletion, and the post-session review.
- `worker/` is the Cloudflare Worker. It serves the built app and exchanges a WebRTC offer with the voice provider at `/api/realtime/session`, which returns 503 until its secrets are configured.

### Built but not yet wired into the app

These modules are tested and kept for the next milestones, but the running app doesn't use them yet:

- **Cloud voice:** `src/voice/OpenAIWebRtcTransport.ts`, `ConversationController.ts`, `TranscriptStore.ts` and `tools/registry.ts`. The app offers an offline mock voice only.
- **Coaching engine:** everything in `src/coaching/`, which covers cue policies, arbitration, phase tracking and spoken-claim validation.
- **Other pieces:** spoken goals (`src/goals/parseSpokenGoal.ts`), session export and summary (`src/review/exportSession.ts`, `buildSummary.ts`), camera-motion estimation (`src/wobble/cameraMotion.ts`) and field-study analysis (`src/research/`).

## Documentation

- `docs/specs/` holds the product and subsystem contracts.
- `docs/plans/` holds the original implementation plans, kept as a historical record.
- `docs/research/` and `docs/reviews/` hold the evidence, decisions, risks and adversarial reviews.
- [`docs/runbook.md`](docs/runbook.md), [`docs/release-checklist.md`](docs/release-checklist.md) and [`research/field/protocol.md`](research/field/protocol.md) cover the consolidated field test.

Claims in the docs carry one of four labels:

- **Verified-doc:** backed by a cited primary source.
- **Measured:** produced by a named harness.
- **Engineering inference:** a design judgement that is still waiting on a gate.
- **Domain hypothesis:** needs review by a pottery instructor.

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md). Pottery Coach is released under the [MIT License](LICENSE).

The AprilTag detector and tag patterns come from [AprilRobotics](https://github.com/AprilRobotics/apriltag) via [apriltag-js](https://github.com/AliAlimohamad/apriltag-js), under the BSD-2-Clause license (see [`third_party/apriltag`](third_party/apriltag)).
