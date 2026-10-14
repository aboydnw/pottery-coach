import type { ConversationState, RealtimeCoachTransport, RealtimeEvent, RealtimeSessionConfig } from "./types";
import { validateSpokenClaim, type ClaimValidation } from "../coaching/ClaimValidator";
import type { CueCandidate } from "../coaching/types";

type CompactContext = { goalId: string | null; phase: string; policyRevision: number };

export function reconnectDelayMs(attempt: number): number | null {
  return attempt >= 5 ? null : [0, 1000, 2000, 4000, 8000][attempt]!;
}

export class ConversationController {
  private state: ConversationState = "idle";
  private transport: RealtimeCoachTransport | null = null;
  private unsubscribe: (() => void) | null = null;
  private config: RealtimeSessionConfig | null = null;
  private reconnectAttempt = 0;
  private intentionallyClosed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private compactContext: CompactContext = { goalId: null, phase: "setup", policyRevision: 1 };
  private ephemeralReadingId: string | null = null;
  private proactiveCloudSpeechEnabled = true;
  private claimAudit: Array<{ policyId: string; validation: ClaimValidation }> = [];

  constructor(private readonly createTransport: () => RealtimeCoachTransport) {}

  getState(): ConversationState { return this.state; }
  setCompactContext(context: CompactContext): void { this.compactContext = { ...context }; }
  getCompactContext(): CompactContext { return { ...this.compactContext }; }
  setEphemeralReadingId(id: string | null): void { this.ephemeralReadingId = id; }
  getEphemeralReadingId(): string | null { return this.ephemeralReadingId; }
  isProactiveCloudSpeechEnabled(): boolean { return this.proactiveCloudSpeechEnabled; }
  getClaimAudit() { return this.claimAudit.map((entry) => ({ ...entry, validation: { ...entry.validation, violations: [...entry.validation.violations] } })); }
  validateFinalClaim(transcript: string, cue: CueCandidate, toolResults: Array<Record<string, unknown>>) {
    const validation = validateSpokenClaim(transcript, cue, toolResults);
    this.claimAudit.push({ policyId: cue.policyId, validation });
    if (validation.disableProactiveCloudSpeech) this.proactiveCloudSpeechEnabled = false;
    return validation;
  }

  async connect(config: RealtimeSessionConfig): Promise<void> {
    this.config = config;
    this.intentionallyClosed = false;
    this.reconnectAttempt = 0;
    this.state = "connecting";
    await this.openTransport();
  }
  async pause(): Promise<void> { await this.transport?.pauseInput(); this.state = "paused"; }
  async resume(): Promise<void> { await this.transport?.resumeInput(); this.state = "connected"; }
  async close(): Promise<void> {
    this.intentionallyClosed = true;
    this.cancelReconnect();
    await this.disposeTransport();
    this.state = "closed";
  }
  private async openTransport(): Promise<void> {
    if (!this.config || this.intentionallyClosed) return;
    await this.disposeTransport();
    const transport = this.createTransport();
    this.transport = transport;
    this.unsubscribe = transport.onEvent((event) => this.handleEvent(transport, event));
    try {
      await transport.connect(this.config);
      if (this.transport !== transport) return;
      this.state = "connected";
      this.reconnectAttempt = 0;
    } catch {
      if (this.transport === transport) this.scheduleReconnect();
    }
  }
  private async disposeTransport(): Promise<void> {
    const transport = this.transport;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.transport = null;
    await transport?.close();
  }
  private handleEvent(transport: RealtimeCoachTransport, event: RealtimeEvent): void {
    if (transport !== this.transport) return;
    if (event.type === "connected") this.state = "connected";
    if (event.type === "closed" && !this.intentionallyClosed) this.scheduleReconnect();
  }
  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null || this.intentionallyClosed) return;
    const delay = reconnectDelayMs(this.reconnectAttempt++);
    if (delay === null) { this.state = "failed"; return; }
    this.state = "reconnecting";
    this.ephemeralReadingId = null;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.openTransport();
    }, delay);
  }
  private cancelReconnect(): void {
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }
}
