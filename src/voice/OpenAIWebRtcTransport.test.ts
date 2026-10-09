import { expect, it, vi } from "vitest";

import { OpenAIWebRtcTransport } from "./OpenAIWebRtcTransport";

it("exchanges an offer, routes remote audio, stops tracks, and closes idempotently", async () => {
  const track = { stop: vi.fn(), enabled: true, readyState: "live" } as unknown as MediaStreamTrack;
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
  const channel = Object.assign(new EventTarget(), { readyState: "open", send: vi.fn(), close: vi.fn() }) as unknown as RTCDataChannel;
  const peer = Object.assign(new EventTarget(), {
    addTrack: vi.fn(), createDataChannel: vi.fn(() => channel), createOffer: vi.fn().mockResolvedValue({ type: "offer", sdp: "v=0 offer long enough" }),
    setLocalDescription: vi.fn(), setRemoteDescription: vi.fn(), close: vi.fn(), connectionState: "connected",
  }) as unknown as RTCPeerConnection;
  const audio = { autoplay: false, playsInline: false, srcObject: null, play: vi.fn().mockResolvedValue(undefined), pause: vi.fn() } as unknown as HTMLAudioElement;
  const fetch = vi.fn().mockResolvedValue(new Response("v=0 answer", { status: 200, headers: { "content-type": "application/sdp" } }));
  const transport = new OpenAIWebRtcTransport({ createPeer: () => peer, getUserMedia: vi.fn().mockResolvedValue(stream), createAudio: () => audio, fetch });

  await transport.connect({ provider: "openai", model: "server-owned", voice: "server-owned", language: "en", instructionsRevision: "i1", toolsRevision: "t1" });
  expect(fetch).toHaveBeenCalledWith("/api/realtime/session", expect.objectContaining({ method: "POST" }));
  expect(peer.setRemoteDescription).toHaveBeenCalledWith({ type: "answer", sdp: "v=0 answer" });
  await transport.close(); await transport.close();
  expect(track.stop).toHaveBeenCalledOnce(); expect(peer.close).toHaveBeenCalledOnce();
});

it("rejects malformed provider events instead of notifying listeners", async () => {
  const channel = Object.assign(new EventTarget(), { readyState: "open", send: vi.fn(), close: vi.fn() }) as unknown as RTCDataChannel;
  const peer = Object.assign(new EventTarget(), { addTrack: vi.fn(), createDataChannel: () => channel, createOffer: vi.fn().mockResolvedValue({ type: "offer", sdp: "v=0 offer long enough" }), setLocalDescription: vi.fn(), setRemoteDescription: vi.fn(), close: vi.fn(), connectionState: "connected" }) as unknown as RTCPeerConnection;
  const transport = new OpenAIWebRtcTransport({ createPeer: () => peer, getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [], getAudioTracks: () => [] } as unknown as MediaStream), createAudio: () => ({ play: vi.fn(), pause: vi.fn() } as unknown as HTMLAudioElement), fetch: vi.fn().mockResolvedValue(new Response("v=0 answer")) });
  const listener = vi.fn(); transport.onEvent(listener);
  await transport.connect({ provider: "openai", model: "x", voice: "x", language: "en", instructionsRevision: "i", toolsRevision: "t" });
  channel.dispatchEvent(new MessageEvent("message", { data: "not-json" }));
  expect(listener).not.toHaveBeenCalledWith(expect.objectContaining({ type: "tool-call" }));
});
