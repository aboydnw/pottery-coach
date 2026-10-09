import { afterEach, expect, it, vi } from "vitest";

import { ConversationController, reconnectDelayMs } from "./ConversationController";
import { MockRealtimeTransport } from "./MockRealtimeTransport";
import type { RealtimeSessionConfig } from "./types";

const config: RealtimeSessionConfig = {
  provider: "mock", model: "mock-v1", voice: "local", language: "en",
  instructionsRevision: "instructions-v1", toolsRevision: "tools-v1",
};

afterEach(() => vi.useRealTimers());

it("uses reconnect delays of 0, 1, 2, 4, and 8 seconds and stops after five attempts", () => {
  expect(Array.from({ length: 6 }, (_, index) => reconnectDelayMs(index))).toEqual([0, 1000, 2000, 4000, 8000, null]);
});

it("transitions deterministically through connect, pause, resume, and close", async () => {
  const transport = new MockRealtimeTransport();
  const controller = new ConversationController(() => transport);
  expect(controller.getState()).toBe("idle");
  await controller.connect(config);
  expect(controller.getState()).toBe("connected");
  await controller.pause(); expect(controller.getState()).toBe("paused");
  await controller.resume(); expect(controller.getState()).toBe("connected");
  await controller.close(); expect(controller.getState()).toBe("closed");
});

it("does not restore stale readings when reconnecting a fresh session", async () => {
  const transports: MockRealtimeTransport[] = [];
  const controller = new ConversationController(() => {
    const transport = new MockRealtimeTransport(); transports.push(transport); return transport;
  });
  controller.setCompactContext({ goalId: "goal-1", phase: "pulling", policyRevision: 2 });
  controller.setEphemeralReadingId("reading-stale");
  await controller.connect(config);
  transports[0]!.emit({ type: "closed", reason: "network" });
  await vi.waitFor(() => expect(transports.length).toBe(2));
  expect(controller.getEphemeralReadingId()).toBeNull();
  expect(controller.getCompactContext()).toEqual({ goalId: "goal-1", phase: "pulling", policyRevision: 2 });
});
