# Observability and evaluation specification

```ts
type DiagnosticSample = { timestampMs:number; previewFps:number; acquiredFps:number; processedFps:number; uiFps:number; frameAgeMsP50:number; frameAgeMsP95:number; droppedFrames:number; workerProcessingMsP95:number; memoryBytes:number|null; batteryLevel:number|null; thermalSignal:"none"|"rate-drop"|"os-warning" };
type AuditCueEvent = { cueId:string; policyId:string; policyRevision:number; timestampMs:number; evidenceIds:string[]; confidence:number; freshnessMs:number; action:"spoken"|"suppressed"|"cancelled"; reason:string };
type BenchmarkRun = { benchmarkVersion:string; commit:string; fixtureId:string; startedAt:string; device:string; os:string; browser:string; configHash:string; metrics:Record<string,number|null>; exclusions:string[]; unmeasurableCount:number; artifactChecksums:string[] };
```

Log calibration, coarse device/browser class, rates/latency, confidence, readings/events, function calls, cue decisions/suppressions, errors, user commands, provider usage, consent revision, and outcome. Never log frame pixels, microphone payloads, credentials, full device IDs, or content in URLs. Pseudonymous session IDs rotate.

Diagnostics are local by default. Opt-in upload applies allow-list redaction and daily/session limits. Benchmark JSONL is immutable; summaries report per-condition numerator/denominator, exclusions, abstention, p50/p95, and cluster-bootstrap intervals. Each architecture gate has a signed decision file with evidence links, decision, reviewer, and rollback.

Trust assertions: every numeric spoken token is matched to a tool result/evidence ID; stale/low-confidence proactive claims equal zero; same-policy cues inside cooldown equal zero; network test sees no video/image payload without opt-in; deletion inventory returns only deleted/not-present or a disclosed provider exception.
