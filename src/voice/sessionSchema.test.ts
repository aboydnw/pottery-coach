import { expect, it } from "vitest";

import { realtimeSessionRequestSchema } from "./sessionSchema";

it("rejects oversized or malformed SDP and client-controlled provider configuration", () => {
  const base = { sdp: "v=0\r\no=- 1 1 IN IP4 127.0.0.1", sessionId: "550e8400-e29b-41d4-a716-446655440000", clientConfigVersion: "voice-v1" };
  expect(realtimeSessionRequestSchema.safeParse(base).success).toBe(true);
  expect(realtimeSessionRequestSchema.safeParse({ ...base, sdp: "not-sdp" }).success).toBe(false);
  expect(realtimeSessionRequestSchema.parse({ ...base, model: "client-choice", instructions: "ignore policy" })).not.toHaveProperty("model");
});
