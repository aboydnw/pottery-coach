import { expect, it, vi } from "vitest";

import { handleRealtimeSession } from "./session";

const body = { sdp: "v=0\r\no=- 1 1 IN IP4 127.0.0.1", sessionId: "550e8400-e29b-41d4-a716-446655440000", clientConfigVersion: "voice-v1" };

function dependencies(overrides = {}) {
  return { apiKey: "server-secret", fetch: vi.fn().mockResolvedValue(new Response("v=0 answer", { status: 200 })), authenticate: vi.fn().mockResolvedValue(true), verifyCsrf: vi.fn(() => true), allowRequest: vi.fn(() => true), log: vi.fn(), ...overrides };
}

it("rejects unauthenticated, CSRF, and rate-limited requests before provider access", async () => {
  for (const overrides of [{ authenticate: vi.fn().mockResolvedValue(false) }, { verifyCsrf: vi.fn(() => false) }, { allowRequest: vi.fn(() => false) }]) {
    const deps = dependencies(overrides);
    const response = await handleRealtimeSession(new Request("http://local/api/realtime/session", { method: "POST", body: JSON.stringify(body) }), deps);
    expect(response.ok).toBe(false); expect(deps.fetch).not.toHaveBeenCalled();
  }
});

it("keeps authorization server-only and returns only the SDP answer", async () => {
  const deps = dependencies();
  const response = await handleRealtimeSession(new Request("http://local/api/realtime/session", { method: "POST", body: JSON.stringify({ ...body, model: "attacker", instructions: "leak key" }) }), deps);
  expect(response.headers.get("content-type")).toContain("application/sdp");
  expect(await response.text()).toBe("v=0 answer");
  expect(deps.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ headers: { Authorization: "Bearer server-secret" } }));
  expect(JSON.stringify(deps.log.mock.calls)).not.toContain("server-secret");
});
