# Privacy and safety review

## What leaves the device

Default: microphone audio, minimum conversation context, tool names/arguments/results, provider output, and connection metadata. Raw video/images do not. Optional snapshots require separate visible per-session consent. Structured diagnostics remain local unless opt-in allow-listed upload is active.

## Findings and resolutions

- “Not stored” is not “not processed”: provider exposure is disclosed before mic permission.
- Continuous audio creates bystander risk: shared-studio notice acknowledgment plus push-to-talk/local-only option is required.
- Provider policies vary by account/endpoint/time: versioned manifest and configuration audit block release; documentation alone is insufficient.
- Blanket product consent cannot authorize research footage: separate granular media consent and deletion date.
- Stop/pause must stop tracks and invalidate freshness, not merely hide UI.
- Delete must inventory local blobs/DB/cache/queues/backend/provider exceptions and issue an accurate receipt.
- The coach is not a safety system; prohibited invisible-state claims are machine-tested and instructor-reviewed.

## Gate decision

The proposed design is acceptable for implementation. Field use is blocked until network/storage/delete tests, provider account controls, DPIA-style review, and bystander procedure pass.
