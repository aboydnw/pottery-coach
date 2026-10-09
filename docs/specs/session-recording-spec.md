# Session recording specification

```ts
type ConsentState = { cameraLocal:boolean; cloudAudio:boolean; transcriptRetention:boolean; snapshotUpload:boolean; researchMedia:boolean; policyRevision:string; grantedAtMs:number };
type SessionRecord = { id:string; schemaVersion:1; startedAtMs:number; endedAtMs:number|null; goal:ThrowingGoal|null; deviceClass:string; calibrationId:string|null; consent:ConsentState; outcome:"completed"|"abandoned"|"failed"|null };
type SessionEvent = { id:string; sessionId:string; timestampMs:number; type:string; evidenceIds:string[]; payload:Record<string,unknown> };
type MarkedMoment = { id:string; sessionId:string; timestampMs:number; label:string; stillBlobId:string|null; localOnly:boolean };
type DeletionReceipt = { sessionId:string; requestedAtMs:number; completedAtMs:number; stores:Array<{name:string;status:"deleted"|"not-present"|"provider-exception"}> };
```

IndexedDB stores session, downsampled stable readings (max 2 Hz), events, cues/tool calls, diagnostics (max 1 Hz), optional transcripts, and user-marked still blobs. Raw frames/audio never enter storage. A local still requires explicit mark/snapshot action and is local-only unless separate upload consent is active.

Summary generation uses structured aggregates and approved transcript excerpts; missing data remains missing. Export is versioned JSON plus optional CSV. Default expiry is 30 days and runs at startup/end. Delete is idempotent, closes active media, removes related object stores/queued sync, calls backend deletion if present, and returns a receipt.
