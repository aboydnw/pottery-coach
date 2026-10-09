# Controlled prototype release checklist

Plan-to-evidence detail is maintained in [`implementation-audit.md`](implementation-audit.md).

- [x] Unit tests cover camera, calibration, measurement, targets, wobble, voice, coaching, recording, review, and lifecycle.
- [x] Raw media is absent from session storage and default network paths.
- [x] Numeric, wobble, provider voice, storage, and mobile support can be disabled independently.
- [ ] Consolidated iPhone and Android 20-minute runs pass the integrated protocol.
- [ ] Two wheel instructors approve every proactive cue; proactive cues remain disabled meanwhile.
- [ ] Provider retention, region, subprocessors, and deletion behavior are verified in the configured account.
- [ ] Privacy, accessibility, architecture, and performance reviewers sign the release evidence.

Unchecked gates narrow the build to a controlled research prototype; they are never interpreted as acceptance.
