export type ConversationState = "idle" | "connecting" | "connected" | "reconnecting" | "paused" | "failed" | "closed";
export type RealtimeSessionConfig = {
  provider: "openai" | "gemini" | "mock";
  model: string;
  voice: string;
  language: string;
  instructionsRevision: string;
  toolsRevision: string;
  /** Lasting notes and a recent-pieces digest, appended to the coach's instructions by the server. */
  potterContext?: string;
};
export type ProviderUsage = {
  inputTextTokens: number;
  outputTextTokens: number;
  inputAudioTokens: number;
  outputAudioTokens: number;
  /** Parts of the input served from the prompt cache, billed at a lower rate. */
  cachedInputTextTokens?: number;
  cachedInputAudioTokens?: number;
};
export type ApprovedCue = { id: string; text: string; evidenceIds: string[] };
export type RealtimeEvent =
  | { type: "connected" }
  | { type: "speech-started"; timestampMs: number }
  | { type: "speech-stopped"; timestampMs: number }
  | { type: "transcript-delta"; eventId: string; speaker: "user" | "assistant"; text: string; timestampMs: number }
  | { type: "transcript-final"; eventId: string; speaker: "user" | "assistant"; text: string; timestampMs: number }
  | { type: "tool-call"; callId: string; name: string; arguments: unknown }
  | { type: "output-started"; itemId: string; timestampMs: number }
  | { type: "output-stopped"; itemId: string; timestampMs: number; reason?: string }
  | { type: "usage"; usage: ProviderUsage }
  | { type: "error"; code: string; message: string }
  | { type: "closed"; reason: string };

export interface RealtimeCoachTransport {
  connect(config: RealtimeSessionConfig): Promise<void>;
  sendToolResult(callId: string, result: unknown): Promise<void>;
  speakApprovedCue(cue: ApprovedCue): Promise<void>;
  /** Prompts the model to speak first (greeting, or picking up after a reconnect). */
  startResponse(): Promise<void>;
  /** Replaces the coach's instructions mid-call (when what it knows about the potter changes). */
  updateInstructions(instructions: string): Promise<void>;
  cancelOutput(reason: string): Promise<void>;
  pauseInput(): Promise<void>;
  resumeInput(): Promise<void>;
  close(): Promise<{ usage: ProviderUsage | null }>;
  onEvent(listener: (event: RealtimeEvent) => void): () => void;
}
