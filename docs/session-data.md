# Session data, summaries, and exports

Schema version 1 stores a session header, stable readings at at most 2 Hz, diagnostics at at most 1 Hz, events/cue/tool-call facts, marked moments, optional consented transcripts, and explicitly marked still blobs in separate IndexedDB tables. The write queue is bounded at 100 and discards diagnostics before evidence. Quota or database failure changes the session to disclosed ephemeral mode. Continuous camera frames, masks, and microphone audio have no storage field.

Pre-v1 imports use conservative consent defaults: cloud audio, transcript retention, snapshot upload, and research media are all false. Future migrations must preserve missing values rather than interpolate them and increment the schema revision.

Summaries use only readings at or above the eligibility threshold. Peak and final dimensions carry their evidence IDs. Low-confidence intervals contribute to unmeasurable duration and remain chart gaps. Goal milestones are copied only from evidence-linked events. Missing transcript data stays missing; no prose completion is inferred.

JSON export has `exportSchemaVersion: 1` and deterministic property ordering for a fixed record. Reading CSV includes session, reading, timestamp, confidence, height, and width; formula-leading cells are prefixed to prevent spreadsheet execution. Exports do not add raw media.

Ended sessions expire 30 days after `endedAtMs`; active sessions are excluded. Explicit deletion follows [`deletion-inventory.md`](deletion-inventory.md) and produces a downloadable receipt.
