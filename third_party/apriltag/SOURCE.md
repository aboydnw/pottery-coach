# AprilTag browser detector provenance

- Upstream: `https://github.com/AliAlimohamad/apriltag-js`
- Pinned commit: `4359086c430e44342098a464c359aacf00cf6bc8`
- Retrieved: 2026-10-09
- Family: `tagStandard41h12`
- License: BSD-2-Clause text in `LICENSE`

Vendored files and SHA-256:

- `apriltag-wasm-wrapper.js`: `e4c0babf9b9b88b6007ebdcf8249a64689aa1a3197c9029c294bafd57292b11f`
- `apriltag_wasm.js`: `bd2d5f3f0de0ba0aa72b64996bb595cdedc52e1130d9c5331673ea3e6c66c1ea`
- `apriltag_wasm.wasm`: `5e94b2449e8cbe73412fd7457d7d322df4c139b1ce4288f503f96837db36e3fa`
- `tag-families.js`: `b733ec9d1d25d1ce2a38a026565491287df2446bc3499ee0d48b3229df164636`

The upstream project wraps the AprilRobotics detector compiled with Emscripten. The official AprilRobotics README recommends `tagStandard41h12` and links this browser port as its JavaScript/WebAssembly option. Runtime code is isolated in a dedicated worker. Mobile performance remains unvalidated until the integrated phone test.
