# Session deletion inventory

Session deletion stops active media first and removes the session row, readings, diagnostics, events, marked moments, transcripts, and still blobs from IndexedDB. Cache Storage and the sync queue are inventoried even when unused.

The default web app has no backend session persistence. Its receipt therefore records a `provider-exception` instead of claiming provider-side deletion. If a backend adapter is configured, success or failure is recorded separately. Deletion is idempotent: repeating it reports local stores as `not-present`.

Structured session data expires after 30 days. Active sessions are excluded. Raw continuous camera and microphone media is never recorded.
