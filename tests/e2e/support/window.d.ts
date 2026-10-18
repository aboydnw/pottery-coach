/** The scripted stand-in voice the app exposes in demo mode (see src/voice/scriptedVoice.ts). */
interface Window {
  __potteryVoice?: {
    callTool(name: string, args?: Record<string, unknown>): Promise<unknown>;
    say(speaker: "user" | "assistant", text: string): void;
    readonly connected: boolean;
  };
}
