import { expect, it, vi } from "vitest";

import { MockRealtimeTransport } from "./MockRealtimeTransport";

it("emits deterministic events, supports unsubscribe, and closes idempotently", async () => {
  const transport = new MockRealtimeTransport();
  const listener = vi.fn();
  const unsubscribe = transport.onEvent(listener);
  await transport.connect({ provider: "mock", model: "mock", voice: "local", language: "en", instructionsRevision: "i1", toolsRevision: "t1" });
  expect(listener).toHaveBeenCalledWith({ type: "connected" });
  unsubscribe();
  transport.emit({ type: "speech-started", timestampMs: 10 });
  expect(listener).toHaveBeenCalledTimes(1);
  await expect(transport.close()).resolves.toEqual({ usage: null });
  await expect(transport.close()).resolves.toEqual({ usage: null });
});
