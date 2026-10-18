// @vitest-environment jsdom
import { expect, it, vi } from "vitest";

import { mapProviderEvent, OpenAIWebRtcTransport } from "./OpenAIWebRtcTransport";

it("exchanges an offer, routes remote audio, stops tracks, and closes idempotently", async () => {
  const track = { stop: vi.fn(), enabled: true, readyState: "live" } as unknown as MediaStreamTrack;
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
  const channel = Object.assign(new EventTarget(), {
    readyState: "open",
    send: vi.fn(),
    close: vi.fn(),
  }) as unknown as RTCDataChannel;
  const peer = Object.assign(new EventTarget(), {
    addTrack: vi.fn(),
    createDataChannel: vi.fn(() => channel),
    createOffer: vi.fn().mockResolvedValue({ type: "offer", sdp: "v=0 offer long enough" }),
    setLocalDescription: vi.fn(),
    setRemoteDescription: vi.fn(),
    close: vi.fn(),
    connectionState: "connected",
  }) as unknown as RTCPeerConnection;
  const audio = {
    autoplay: false,
    playsInline: false,
    srcObject: null,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
  } as unknown as HTMLAudioElement;
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response("v=0 answer", { status: 200, headers: { "content-type": "application/sdp" } }));
  const transport = new OpenAIWebRtcTransport({
    createPeer: () => peer,
    getUserMedia: vi.fn().mockResolvedValue(stream),
    createAudio: () => audio,
    fetch,
  });

  await transport.connect({
    provider: "openai",
    model: "server-owned",
    voice: "server-owned",
    language: "en",
    instructionsRevision: "i1",
    toolsRevision: "t1",
  });
  expect(fetch).toHaveBeenCalledWith("/api/realtime/session", expect.objectContaining({ method: "POST" }));
  expect(peer.setRemoteDescription).toHaveBeenCalledWith({ type: "answer", sdp: "v=0 answer" });
  await transport.close();
  await transport.close();
  expect(track.stop).toHaveBeenCalledOnce();
  expect(peer.close).toHaveBeenCalledOnce();
});

it("rejects malformed provider events instead of notifying listeners", async () => {
  const channel = Object.assign(new EventTarget(), {
    readyState: "open",
    send: vi.fn(),
    close: vi.fn(),
  }) as unknown as RTCDataChannel;
  const peer = Object.assign(new EventTarget(), {
    addTrack: vi.fn(),
    createDataChannel: () => channel,
    createOffer: vi.fn().mockResolvedValue({ type: "offer", sdp: "v=0 offer long enough" }),
    setLocalDescription: vi.fn(),
    setRemoteDescription: vi.fn(),
    close: vi.fn(),
    connectionState: "connected",
  }) as unknown as RTCPeerConnection;
  const transport = new OpenAIWebRtcTransport({
    createPeer: () => peer,
    getUserMedia: vi
      .fn()
      .mockResolvedValue({ getTracks: () => [], getAudioTracks: () => [] } as unknown as MediaStream),
    createAudio: () => ({ play: vi.fn(), pause: vi.fn() }) as unknown as HTMLAudioElement,
    fetch: vi.fn().mockResolvedValue(new Response("v=0 answer")),
  });
  const listener = vi.fn();
  transport.onEvent(listener);
  await transport.connect({
    provider: "openai",
    model: "x",
    voice: "x",
    language: "en",
    instructionsRevision: "i",
    toolsRevision: "t",
  });
  channel.dispatchEvent(new MessageEvent("message", { data: "not-json" }));
  expect(listener).not.toHaveBeenCalledWith(expect.objectContaining({ type: "tool-call" }));
});

function fakePeer(overrides: Record<string, unknown> = {}) {
  const channel = Object.assign(new EventTarget(), {
    readyState: "open",
    send: vi.fn(),
    close: vi.fn(),
  }) as unknown as RTCDataChannel;
  const sender = { replaceTrack: vi.fn().mockResolvedValue(undefined) };
  const peer = Object.assign(new EventTarget(), {
    addTrack: vi.fn(() => sender),
    createDataChannel: vi.fn(() => channel),
    createOffer: vi.fn().mockResolvedValue({ type: "offer", sdp: "v=0 offer long enough" }),
    setLocalDescription: vi.fn(),
    setRemoteDescription: vi.fn(),
    close: vi.fn(),
    connectionState: "connected",
    ...overrides,
  }) as unknown as RTCPeerConnection;
  return { peer, channel, sender };
}

function fakeStream(readyState = "live") {
  const track = { stop: vi.fn(), enabled: true, readyState } as unknown as MediaStreamTrack;
  return { track, stream: { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream };
}

const config = {
  provider: "openai",
  model: "x",
  voice: "x",
  language: "en",
  instructionsRevision: "i",
  toolsRevision: "t",
} as const;
const audio = () => ({ play: vi.fn().mockResolvedValue(undefined), pause: vi.fn() }) as unknown as HTMLAudioElement;

it("releases the microphone and peer when the session exchange fails", async () => {
  const { peer, channel } = fakePeer();
  const { track, stream } = fakeStream();
  const transport = new OpenAIWebRtcTransport({
    createPeer: () => peer,
    getUserMedia: vi.fn().mockResolvedValue(stream),
    createAudio: audio,
    fetch: vi.fn().mockResolvedValue(new Response("{}", { status: 503 })),
  });

  await expect(transport.connect(config)).rejects.toThrow();

  expect(track.stop).toHaveBeenCalledOnce();
  expect(peer.close).toHaveBeenCalledOnce();
  expect(channel.close).toHaveBeenCalledOnce();
});

it("replaces an ended microphone track on the existing sender without renegotiating", async () => {
  const { peer, sender } = fakePeer();
  const first = fakeStream();
  const replacement = fakeStream();
  const getUserMedia = vi.fn().mockResolvedValueOnce(first.stream).mockResolvedValueOnce(replacement.stream);
  const transport = new OpenAIWebRtcTransport({
    createPeer: () => peer,
    getUserMedia,
    createAudio: audio,
    fetch: vi.fn().mockResolvedValue(new Response("v=0 answer")),
  });
  await transport.connect(config);
  Object.assign(first.track, { readyState: "ended" });

  await transport.resumeInput();

  expect(sender.replaceTrack).toHaveBeenCalledWith(replacement.track);
  expect(peer.addTrack).toHaveBeenCalledOnce();
});

it("sends what the coach knows about the potter with the session request", async () => {
  const { peer } = fakePeer();
  const fetch = vi.fn().mockResolvedValue(new Response("v=0 answer"));
  const transport = new OpenAIWebRtcTransport({
    createPeer: () => peer,
    getUserMedia: vi.fn().mockResolvedValue(fakeStream().stream),
    createAudio: audio,
    fetch,
  });

  await transport.connect({ ...config, potterContext: "- Use inches" });

  expect(JSON.parse(fetch.mock.calls[0]![1].body)).toMatchObject({ potterContext: "- Use inches" });
  expect(fetch.mock.calls[0]![1].headers).not.toHaveProperty("authorization");
});

it("reports when the coach's audio starts, finishes, or is cut off", () => {
  const transcripts = new Map<string, string>();
  expect(mapProviderEvent({ type: "output_audio_buffer.started", response_id: "r1" }, transcripts)).toMatchObject({
    type: "output-started",
    itemId: "r1",
  });
  expect(mapProviderEvent({ type: "output_audio_buffer.stopped", response_id: "r1" }, transcripts)).toMatchObject({
    type: "output-stopped",
    reason: "finished",
  });
  expect(mapProviderEvent({ type: "output_audio_buffer.cleared", response_id: "r1" }, transcripts)).toMatchObject({
    type: "output-stopped",
    reason: "interrupted",
  });
});

it("builds captions from transcript pieces and reports usage", () => {
  const transcripts = new Map<string, string>();
  expect(
    mapProviderEvent({ type: "response.output_audio_transcript.delta", item_id: "a", delta: "It's 12" }, transcripts),
  ).toMatchObject({ type: "transcript-delta", speaker: "assistant", text: "It's 12" });
  expect(
    mapProviderEvent(
      { type: "response.output_audio_transcript.delta", item_id: "a", delta: " centimetres" },
      transcripts,
    ),
  ).toMatchObject({ text: "It's 12 centimetres" });
  expect(
    mapProviderEvent(
      { type: "response.output_audio_transcript.done", item_id: "a", transcript: "It's 12 centimetres." },
      transcripts,
    ),
  ).toMatchObject({ type: "transcript-final", text: "It's 12 centimetres." });
  expect(
    mapProviderEvent(
      { type: "conversation.item.input_audio_transcription.completed", item_id: "u", transcript: "How tall?" },
      transcripts,
    ),
  ).toMatchObject({ speaker: "user", text: "How tall?" });
  expect(
    mapProviderEvent(
      {
        type: "response.done",
        response: {
          usage: {
            input_token_details: { audio_tokens: 40, text_tokens: 5, cached_tokens_details: { audio_tokens: 30 } },
            output_token_details: { audio_tokens: 90, text_tokens: 12 },
          },
        },
      },
      transcripts,
    ),
  ).toEqual({
    type: "usage",
    usage: {
      inputTextTokens: 5,
      inputAudioTokens: 40,
      outputTextTokens: 12,
      outputAudioTokens: 90,
      cachedInputTextTokens: 0,
      cachedInputAudioTokens: 30,
    },
  });
});

it("marks a refused sign-in as not worth retrying", async () => {
  const { peer } = fakePeer();
  const transport = new OpenAIWebRtcTransport({
    createPeer: () => peer,
    getUserMedia: vi.fn().mockResolvedValue(fakeStream().stream),
    createAudio: audio,
    fetch: vi.fn().mockResolvedValue(new Response("{}", { status: 401 })),
  });
  await expect(transport.connect(config)).rejects.toMatchObject({ status: 401, retryable: false });
});

it("speaks a cue as a one-off reply that skips the conversation, then notes it", async () => {
  const { peer, channel } = fakePeer();
  const transport = new OpenAIWebRtcTransport({
    createPeer: () => peer,
    getUserMedia: vi.fn().mockResolvedValue(fakeStream().stream),
    createAudio: audio,
    fetch: vi.fn().mockResolvedValue(new Response("v=0 answer")),
  });
  await transport.connect(config);

  await transport.speakApprovedCue({ id: "cue-1", text: "Top's flaring.", evidenceIds: ["r1"] });

  const sent = (channel.send as ReturnType<typeof vi.fn>).mock.calls.map(([message]) => JSON.parse(String(message)));
  expect(sent.at(-2)).toMatchObject({
    type: "response.create",
    response: { conversation: "none", input: [], metadata: { cueId: "cue-1" } },
  });
  expect(sent.at(-2).response.instructions).toContain("Top's flaring.");
  expect(sent.at(-1)).toMatchObject({ type: "conversation.item.create", item: { role: "system" } });
});
