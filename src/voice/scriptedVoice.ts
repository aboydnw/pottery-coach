import { MockRealtimeTransport } from "./MockRealtimeTransport";

/**
 * A stand-in for the realtime model in demo mode. Tests (or a developer in the console, via
 * `window.__potteryVoice`) play the model's part: speaking captions and calling tools, then reading
 * back what the app answered. It never touches the network or the microphone.
 */
export class ScriptedVoice {
  readonly transport = new MockRealtimeTransport();
  private nextId = 1;

  /** Calls a tool as the model would and resolves with the app's result. */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const callId = `scripted-call-${this.nextId++}`;
    this.transport.emit({ type: "tool-call", callId, name, arguments: args });
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      const sent = this.transport.sentToolResults.find((item) => item.callId === callId);
      if (sent) return sent.result;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`No result for ${name}`);
  }

  /** Says a line. The coach's lines are spoken in full, as if their audio played instantly. */
  say(speaker: "user" | "assistant", text: string): void {
    const itemId = `scripted-caption-${this.nextId++}`;
    if (speaker === "assistant")
      this.transport.emit({ type: "output-started", itemId, timestampMs: performance.now() });
    this.transport.emit({ type: "transcript-final", eventId: itemId, speaker, text, timestampMs: performance.now() });
    if (speaker === "assistant")
      this.transport.emit({ type: "output-stopped", itemId, timestampMs: performance.now(), reason: "finished" });
  }

  /** Cue lines the app asked the coach to say, in order. */
  get spokenCues(): string[] {
    return this.transport.spokenCues.map((cue) => cue.text);
  }

  /** Whether the app still has the call open. */
  get connected(): boolean {
    return !this.transport.isClosed();
  }
}

declare global {
  interface Window {
    __potteryVoice?: ScriptedVoice;
  }
}
