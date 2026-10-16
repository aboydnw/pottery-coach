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

  say(speaker: "user" | "assistant", text: string): void {
    this.transport.emit({
      type: "transcript-final",
      eventId: `scripted-caption-${this.nextId++}`,
      speaker,
      text,
      timestampMs: performance.now(),
    });
  }
}

declare global {
  interface Window {
    __potteryVoice?: ScriptedVoice;
  }
}
