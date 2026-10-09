import type { ApprovedCue, ProviderUsage, RealtimeCoachTransport, RealtimeEvent, RealtimeSessionConfig } from "./types";

type Dependencies = {
  createPeer(): RTCPeerConnection;
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
  createAudio(): HTMLAudioElement;
  fetch: typeof globalThis.fetch;
};

const defaults: Dependencies = {
  createPeer: () => new RTCPeerConnection(),
  getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
  createAudio: () => document.createElement("audio"),
  fetch: globalThis.fetch.bind(globalThis),
};

export class OpenAIWebRtcTransport implements RealtimeCoachTransport {
  private peer: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private localStream: MediaStream | null = null;
  private audio: HTMLAudioElement | null = null;
  private listeners = new Set<(event: RealtimeEvent) => void>();
  private usage: ProviderUsage | null = null;
  private closed = false;

  constructor(private readonly dependencies: Dependencies = defaults) {}

  async connect(_config: RealtimeSessionConfig): Promise<void> {
    this.closed = false;
    const peer = this.dependencies.createPeer();
    const stream = await this.dependencies.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    stream.getAudioTracks().forEach((track) => peer.addTrack(track, stream));
    const channel = peer.createDataChannel("oai-events");
    channel.addEventListener("message", this.onMessage);
    const audio = this.dependencies.createAudio();
    audio.autoplay = true;
    peer.addEventListener("track", (event: RTCTrackEvent) => {
      audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
      void audio.play().catch(() => undefined);
    });
    peer.addEventListener("connectionstatechange", () => {
      if (["failed", "disconnected", "closed"].includes(peer.connectionState)) this.emit({ type: "closed", reason: peer.connectionState });
    });
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    const response = await this.dependencies.fetch("/api/realtime/session", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
      credentials: "same-origin",
      body: JSON.stringify({ sdp: offer.sdp, sessionId: crypto.randomUUID(), clientConfigVersion: "voice-v1" }),
    });
    if (!response.ok) throw new Error(`Realtime session failed (${response.status})`);
    await peer.setRemoteDescription({ type: "answer", sdp: await response.text() });
    this.peer = peer; this.channel = channel; this.localStream = stream; this.audio = audio;
    this.emit({ type: "connected" });
  }

  async sendToolResult(callId: string, result: unknown): Promise<void> {
    this.send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: callId, output: JSON.stringify(result) } });
    this.send({ type: "response.create" });
  }
  async speakApprovedCue(cue: ApprovedCue): Promise<void> {
    this.send({ type: "response.create", response: { instructions: cue.text, metadata: { cueId: cue.id, evidenceIds: cue.evidenceIds } } });
  }
  async cancelOutput(reason: string): Promise<void> {
    this.send({ type: "response.cancel" });
    this.send({ type: "output_audio_buffer.clear" });
    this.audio?.pause();
    this.emit({ type: "output-stopped", itemId: "active", timestampMs: performance.now(), reason });
  }
  async pauseInput(): Promise<void> { this.localStream?.getAudioTracks().forEach((track) => { track.enabled = false; }); }
  async resumeInput(): Promise<void> {
    const tracks = this.localStream?.getAudioTracks() ?? [];
    if (tracks.some((track) => track.readyState === "ended")) {
      const replacement = await this.dependencies.getUserMedia({ audio: true, video: false });
      this.localStream = replacement;
      replacement.getAudioTracks().forEach((track) => this.peer?.addTrack(track, replacement));
    } else tracks.forEach((track) => { track.enabled = true; });
  }
  async close(): Promise<{ usage: ProviderUsage | null }> {
    if (this.closed) return { usage: this.usage };
    this.closed = true;
    this.channel?.removeEventListener("message", this.onMessage);
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.channel?.close(); this.peer?.close(); this.audio?.pause();
    if (this.audio) this.audio.srcObject = null;
    return { usage: this.usage };
  }
  onEvent(listener: (event: RealtimeEvent) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  private send(payload: unknown): void {
    if (this.channel?.readyState !== "open") throw new Error("Realtime data channel is not open");
    this.channel.send(JSON.stringify(payload));
  }
  private readonly onMessage = (event: MessageEvent): void => {
    if (typeof event.data !== "string") return;
    let raw: Record<string, unknown>;
    try { raw = JSON.parse(event.data) as Record<string, unknown>; } catch { return; }
    const mapped = mapProviderEvent(raw);
    if (mapped) {
      if (mapped.type === "usage") this.usage = mapped.usage;
      this.emit(mapped);
    }
  };
  private emit(event: RealtimeEvent): void { this.listeners.forEach((listener) => listener(event)); }
}

function mapProviderEvent(raw: Record<string, unknown>): RealtimeEvent | null {
  const timestampMs = performance.now();
  if (raw.type === "input_audio_buffer.speech_started") return { type: "speech-started", timestampMs };
  if (raw.type === "input_audio_buffer.speech_stopped") return { type: "speech-stopped", timestampMs };
  if (raw.type === "response.function_call_arguments.done" && typeof raw.call_id === "string" && typeof raw.name === "string") {
    let args: unknown = {}; try { args = JSON.parse(String(raw.arguments ?? "{}")); } catch { return null; }
    return { type: "tool-call", callId: raw.call_id, name: raw.name, arguments: args };
  }
  if (raw.type === "error") return { type: "error", code: String((raw.error as Record<string, unknown> | undefined)?.code ?? "provider-error"), message: String((raw.error as Record<string, unknown> | undefined)?.message ?? "Realtime provider error") };
  return null;
}

function readCsrfToken(): string { return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? ""; }
