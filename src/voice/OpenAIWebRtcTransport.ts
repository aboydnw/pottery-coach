import type { ApprovedCue, ProviderUsage, RealtimeCoachTransport, RealtimeEvent, RealtimeSessionConfig } from "./types";

type Dependencies = {
  createPeer(): RTCPeerConnection;
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
  createAudio(): HTMLAudioElement;
  fetch: typeof globalThis.fetch;
  getAccessToken?(): string;
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
  private audioSender: RTCRtpSender | null = null;
  private audio: HTMLAudioElement | null = null;
  private listeners = new Set<(event: RealtimeEvent) => void>();
  private usage: ProviderUsage | null = null;
  private readonly transcripts = new Map<string, string>();
  private closed = false;

  constructor(private readonly dependencies: Dependencies = defaults) {}

  async connect(_config: RealtimeSessionConfig): Promise<void> {
    this.closed = false;
    const peer = this.dependencies.createPeer();
    let stream: MediaStream | null = null;
    let channel: RTCDataChannel | null = null;
    try {
      stream = await this.dependencies.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      const audioTrack = stream.getAudioTracks()[0];
      this.audioSender = audioTrack ? peer.addTrack(audioTrack, stream) : null;
      channel = peer.createDataChannel("oai-events");
      channel.addEventListener("message", this.onMessage);
      const audio = this.dependencies.createAudio();
      audio.autoplay = true;
      peer.addEventListener("track", (event: RTCTrackEvent) => {
        audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
        void audio.play().catch(() => undefined);
      });
      peer.addEventListener("connectionstatechange", () => {
        if (peer.connectionState === "failed" || peer.connectionState === "closed")
          this.emit({ type: "closed", reason: peer.connectionState });
      });
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const accessToken = this.dependencies.getAccessToken?.() ?? "";
      const response = await this.dependencies.fetch("/api/realtime/session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: "same-origin",
        body: JSON.stringify({ sdp: offer.sdp, sessionId: crypto.randomUUID(), clientConfigVersion: "voice-v1" }),
      });
      if (!response.ok) throw new RealtimeSessionError(response.status);
      await peer.setRemoteDescription({ type: "answer", sdp: await response.text() });
      this.peer = peer;
      this.channel = channel;
      this.localStream = stream;
      this.audio = audio;
    } catch (error) {
      channel?.removeEventListener("message", this.onMessage);
      stream?.getTracks().forEach((track) => track.stop());
      channel?.close();
      peer.close();
      this.audioSender = null;
      throw error;
    }
    this.emit({ type: "connected" });
  }
  async sendToolResult(callId: string, result: unknown): Promise<void> {
    this.send({
      type: "conversation.item.create",
      item: { type: "function_call_output", call_id: callId, output: JSON.stringify(result) },
    });
    this.send({ type: "response.create" });
  }
  /** Asks the model to speak without waiting for the potter, so the coach greets them first. */
  async startResponse(): Promise<void> {
    this.send({ type: "response.create" });
  }

  async speakApprovedCue(cue: ApprovedCue): Promise<void> {
    this.send({
      type: "response.create",
      response: { instructions: cue.text, metadata: { cueId: cue.id, evidenceIds: cue.evidenceIds } },
    });
  }
  async cancelOutput(reason: string): Promise<void> {
    this.send({ type: "response.cancel" });
    this.send({ type: "output_audio_buffer.clear" });
    this.audio?.pause();
    this.emit({ type: "output-stopped", itemId: "active", timestampMs: performance.now(), reason });
  }
  async pauseInput(): Promise<void> {
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
  }
  async resumeInput(): Promise<void> {
    const tracks = this.localStream?.getAudioTracks() ?? [];
    if (tracks.some((track) => track.readyState === "ended")) {
      const replacement = await this.dependencies.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      await this.audioSender?.replaceTrack(replacement.getAudioTracks()[0] ?? null);
      this.localStream?.getTracks().forEach((track) => track.stop());
      this.localStream = replacement;
    } else
      tracks.forEach((track) => {
        track.enabled = true;
      });
  }
  async close(): Promise<{ usage: ProviderUsage | null }> {
    if (this.closed) return { usage: this.usage };
    this.closed = true;
    this.channel?.removeEventListener("message", this.onMessage);
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.channel?.close();
    this.peer?.close();
    this.audio?.pause();
    if (this.audio) this.audio.srcObject = null;
    return { usage: this.usage };
  }
  onEvent(listener: (event: RealtimeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private send(payload: unknown): void {
    if (this.channel?.readyState !== "open") throw new Error("Realtime data channel is not open");
    this.channel.send(JSON.stringify(payload));
  }
  private readonly onMessage = (event: MessageEvent): void => {
    if (typeof event.data !== "string") return;
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(event.data) as Record<string, unknown>;
    } catch {
      return;
    }
    const mapped = mapProviderEvent(raw, this.transcripts);
    if (mapped) {
      if (mapped.type === "usage") this.usage = mapped.usage;
      this.emit(mapped);
    }
  };

  private emit(event: RealtimeEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
}

/** Thrown when the session endpoint refuses the request; retrying won't help for auth or disabled voice. */
export class RealtimeSessionError extends Error {
  readonly retryable: boolean;
  constructor(readonly status: number) {
    super(`Realtime session failed (${status})`);
    this.retryable = !(status === 401 || status === 403 || status === 503);
  }
}

/** Browser dependencies for the real transport, with the field-test passphrase as the bearer token. */
export function browserTransportDependencies(getAccessToken: () => string): Dependencies {
  return { ...defaults, getAccessToken };
}

/**
 * Maps provider events to app events. Transcript deltas arrive in pieces, so `transcripts`
 * accumulates text per item to give captions the whole sentence so far.
 */
export function mapProviderEvent(raw: Record<string, unknown>, transcripts: Map<string, string>): RealtimeEvent | null {
  const timestampMs = performance.now();
  if (raw.type === "input_audio_buffer.speech_started") return { type: "speech-started", timestampMs };
  if (raw.type === "input_audio_buffer.speech_stopped") return { type: "speech-stopped", timestampMs };
  // WebRTC reports when the coach's audio actually plays, which is what captions are timed to.
  if (raw.type === "output_audio_buffer.started")
    return { type: "output-started", itemId: String(raw.response_id ?? ""), timestampMs };
  if (raw.type === "output_audio_buffer.stopped" || raw.type === "output_audio_buffer.cleared")
    return {
      type: "output-stopped",
      itemId: String(raw.response_id ?? ""),
      timestampMs,
      reason: raw.type === "output_audio_buffer.cleared" ? "interrupted" : "finished",
    };
  if (
    raw.type === "response.function_call_arguments.done" &&
    typeof raw.call_id === "string" &&
    typeof raw.name === "string"
  ) {
    let args: unknown = {};
    try {
      args = JSON.parse(String(raw.arguments ?? "{}"));
    } catch {
      return null;
    }
    return { type: "tool-call", callId: raw.call_id, name: raw.name, arguments: args };
  }
  const speaker = transcriptSpeaker(raw.type);
  if (speaker && typeof raw.item_id === "string") {
    const eventId = raw.item_id;
    if (typeof raw.delta === "string") {
      const text = (transcripts.get(eventId) ?? "") + raw.delta;
      transcripts.set(eventId, text);
      return { type: "transcript-delta", eventId, speaker, text, timestampMs };
    }
    if (typeof raw.transcript === "string") {
      transcripts.delete(eventId);
      return { type: "transcript-final", eventId, speaker, text: raw.transcript, timestampMs };
    }
  }
  if (raw.type === "response.done") {
    const usage = (raw.response as { usage?: Record<string, unknown> } | undefined)?.usage;
    if (!usage) return null;
    const input = (usage.input_token_details ?? {}) as Record<string, number>;
    const output = (usage.output_token_details ?? {}) as Record<string, number>;
    return {
      type: "usage",
      usage: {
        inputTextTokens: input.text_tokens ?? 0,
        inputAudioTokens: input.audio_tokens ?? 0,
        outputTextTokens: output.text_tokens ?? 0,
        outputAudioTokens: output.audio_tokens ?? 0,
      },
    };
  }
  if (raw.type === "error")
    return {
      type: "error",
      code: String((raw.error as Record<string, unknown> | undefined)?.code ?? "provider-error"),
      message: String((raw.error as Record<string, unknown> | undefined)?.message ?? "Realtime provider error"),
    };
  return null;
}

function transcriptSpeaker(type: unknown): "user" | "assistant" | null {
  if (type === "response.output_audio_transcript.delta" || type === "response.output_audio_transcript.done")
    return "assistant";
  if (
    type === "conversation.item.input_audio_transcription.delta" ||
    type === "conversation.item.input_audio_transcription.completed"
  )
    return "user";
  return null;
}
