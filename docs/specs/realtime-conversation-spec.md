# Realtime conversation specification

```ts
type ConversationState = "idle"|"connecting"|"connected"|"reconnecting"|"paused"|"failed"|"closed";
type RealtimeSessionConfig = { provider:"openai"|"gemini"|"mock"; model:string; voice:string; language:string; instructionsRevision:string; toolsRevision:string };
interface RealtimeCoachTransport { connect(config:RealtimeSessionConfig):Promise<void>; sendToolResult(callId:string,result:unknown):Promise<void>; speakApprovedCue(cue:CueCandidate):Promise<void>; cancelOutput(reason:string):Promise<void>; pauseInput():Promise<void>; resumeInput():Promise<void>; close():Promise<{usage:ProviderUsage|null}>; onEvent(listener:(event:RealtimeEvent)=>void):()=>void; }
type CoachingFunctions = { setGoal(input:ThrowingGoal):Promise<GoalConfirmation>; getCurrentDimensions():Promise<DimensionReading>; getWobbleStatus():Promise<WobbleReading>; compareTargetProfile():Promise<ProfileComparison>; getMeasurementConfidence():Promise<ConfidenceReading>; pauseCoaching():Promise<void>; resumeCoaching():Promise<void>; markMoment(input:MarkMomentInput):Promise<MarkedMoment> };
```

`POST /api/realtime/session` authenticates the app user/session, rate-limits, injects pinned instructions/tools, and performs the provider's unified exchange or returns a short-lived credential. Standard provider keys never reach the client. WebRTC is the OpenAI path; all data-channel messages validate against schemas and unknown tools fail closed.

Server VAD is default, with studio-noise tuning. Speech start cancels and clears/truncates unplayed output; the client records cancellation latency. Reconnect uses exponential delays 0/1/2/4/8 s capped at 15 s, at most five attempts, and restores only a compact goal/phase/policy summary—never stale readings. Session expiry at 18 minutes prompts graceful renewal before a 20-minute session if provider limit/config requires it.

Input/output transcripts are diagnostic conversational records, not perception truth. User may disable transcript retention. Offline mode preserves local UI and approved local cues. All measurement questions call tools; instructions prohibit untooled quantitative answers.
