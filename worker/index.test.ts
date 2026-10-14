import { expect, it, vi } from "vitest";
import worker from "./index";

function env(overrides: Record<string, unknown> = {}) {
  return {
    ASSETS: { fetch: vi.fn(async () => new Response("<!doctype html>", { headers: { "content-type": "text/html" } })) },
    REALTIME_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
    VOICE_MODEL: "gpt-realtime-2.1-mini",
    REALTIME_ALLOWED_ORIGINS: "",
    ...overrides,
  } as unknown as Parameters<typeof worker.fetch>[1];
}

const call = (request: Request, bindings = env()) =>
  worker.fetch(request as Parameters<typeof worker.fetch>[0], bindings);

it("hands non-API requests to the static assets", async () => {
  const bindings = env();
  const response = await call(new Request("https://potterycoach.example/session/live"), bindings);
  expect(await response.text()).toContain("doctype");
  expect(bindings.ASSETS.fetch).toHaveBeenCalledOnce();
});

it("keeps cloud voice disabled until both secrets are configured", async () => {
  const response = await call(new Request("https://potterycoach.example/api/realtime/session", { method: "POST" }));
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toContain("no-store");
});

it("rejects unknown API paths and non-POST session requests without touching assets", async () => {
  const bindings = env({ OPENAI_API_KEY: "key", REALTIME_ACCESS_TOKEN: "token" });
  expect((await call(new Request("https://potterycoach.example/api/unknown"), bindings)).status).toBe(404);
  expect((await call(new Request("https://potterycoach.example/api/realtime/session"), bindings)).status).toBe(405);
  expect(bindings.ASSETS.fetch).not.toHaveBeenCalled();
});

it("applies the Cloudflare rate limit per client address", async () => {
  const limit = vi.fn(async () => ({ success: false }));
  const bindings = env({ OPENAI_API_KEY: "key", REALTIME_ACCESS_TOKEN: "token", REALTIME_RATE_LIMITER: { limit } });
  const response = await call(
    new Request("https://potterycoach.example/api/realtime/session", {
      method: "POST",
      headers: {
        authorization: "Bearer token",
        origin: "https://potterycoach.example",
        "cf-connecting-ip": "203.0.113.4",
        "content-type": "application/json",
      },
      body: "{}",
    }),
    bindings,
  );
  expect(response.status).toBe(429);
  expect(limit).toHaveBeenCalledWith({ key: "203.0.113.4" });
});
