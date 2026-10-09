import type { ApprovedCue, ProviderUsage, RealtimeCoachTransport, RealtimeEvent, RealtimeSessionConfig } from "./types";

export class MockRealtimeTransport implements RealtimeCoachTransport {
  private listeners = new Set<(event: RealtimeEvent) => void>();
  private closed = false;
  private paused = false;
  readonly sentToolResults: Array<{ callId: string; result: unknown }> = [];
  readonly spokenCues: ApprovedCue[] = [];

  async connect(_config: RealtimeSessionConfig): Promise<void> {
    this.closed = false;
    this.emit({ type: "connected" });
  }
  async sendToolResult(callId: string, result: unknown): Promise<void> { this.sentToolResults.push({ callId, result }); }
  async speakApprovedCue(cue: ApprovedCue): Promise<void> { this.spokenCues.push(cue); }
  async cancelOutput(reason: string): Promise<void> { this.emit({ type: "output-stopped", itemId: "mock-output", timestampMs: performance.now(), reason }); }
  async pauseInput(): Promise<void> { this.paused = true; }
  async resumeInput(): Promise<void> { this.paused = false; }
  isPaused(): boolean { return this.paused; }
  async close(): Promise<{ usage: ProviderUsage | null }> {
    if (!this.closed) { this.closed = true; this.emit({ type: "closed", reason: "client-close" }); }
    return { usage: null };
  }
  onEvent(listener: (event: RealtimeEvent) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit(event: RealtimeEvent): void { this.listeners.forEach((listener) => listener(event)); }
}
