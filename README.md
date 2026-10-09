# Pottery Coach Prototype Planning Package

This repository contains a research-backed specification and nine executable implementation plans for a web-first, hands-free AI pottery coach. It intentionally contains no production implementation.

The implementation now begins with the Plan 1 web scaffold and browser capability contract. It remains a prototype until the physical-device gates below are completed.

Research was completed on 2026-10-08. Claims based on documentation are cited inline. Physical-device, real-object, paid-API, and instructor gates remain explicitly unpassed because the research environment had no phones, calibration objects, pottery footage, provider credentials, or recruited instructor.

Start with `docs/research/00-executive-summary.md`, then execute `docs/plans/01-foundation-and-camera-plan.md` only after accepting the gate policy in `docs/research/11-architecture-decision-record.md`.

## Document map

- `docs/research/`: evidence, decisions, benchmark status, risks, and open questions.
- `docs/specs/`: normative product and subsystem contracts.
- `docs/plans/`: test-driven, independently reviewable implementation sequences.
- `docs/reviews/`: adversarial reviews and residual objections.

## Evidence labels

- **Verified-doc:** supported by a cited primary or authoritative source.
- **Measured:** produced by a named reproducible harness. No mobile or physical measurements have this label yet.
- **Engineering inference:** a design judgment awaiting a gate.
- **Domain hypothesis:** requires pottery-instructor review.

## Local development

Use Node 24 and pnpm 10:

```sh
pnpm install
pnpm dev
```

Camera access requires HTTPS except on `localhost`. The app never requests camera or microphone access on page load; a user gesture is required. Raw camera frames remain on the device and are neither persisted nor sent over the network by default.

Run the current verification suite with:

```sh
pnpm test
pnpm typecheck
pnpm build
```

Run Chromium fake-camera checks with `pnpm e2e`. Run a diagnostic desktop harness session with `pnpm benchmark:camera -- --duration=60 --mode=camera-worker`. Physical-device runs must follow [`docs/device-test-protocol.md`](docs/device-test-protocol.md). No browser or device is considered supported until its linked 20-minute camera-only and camera-worker artifacts satisfy Gate 1; fake media never establishes support.
