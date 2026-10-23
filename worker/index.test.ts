import { expect, it, vi } from "vitest";
import worker from "./index";
import { sqliteD1 } from "./testing/sqliteD1";

function env(overrides: Record<string, unknown> = {}) {
  return {
    ASSETS: { fetch: vi.fn(async () => new Response("<!doctype html>", { headers: { "content-type": "text/html" } })) },
    REALTIME_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
    SYNC_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
    DB: sqliteD1(),
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

it("keeps cloud voice disabled until the OpenAI key is configured", async () => {
  const response = await call(new Request("https://potterycoach.example/api/realtime/session", { method: "POST" }));
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toContain("no-store");
});

it("rejects unknown API paths and non-POST session requests without touching assets", async () => {
  const bindings = env({ OPENAI_API_KEY: "key" });
  expect((await call(new Request("https://potterycoach.example/api/unknown"), bindings)).status).toBe(404);
  expect((await call(new Request("https://potterycoach.example/api/realtime/session"), bindings)).status).toBe(405);
  expect(bindings.ASSETS.fetch).not.toHaveBeenCalled();
});

it("applies the Cloudflare rate limit per client address", async () => {
  const limit = vi.fn(async () => ({ success: false }));
  const bindings = env({ OPENAI_API_KEY: "key", REALTIME_RATE_LIMITER: { limit } });
  const response = await call(
    new Request("http://localhost/api/realtime/session", {
      method: "POST",
      headers: {
        origin: "http://localhost",
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

it("only starts voice for a signed-in potter", async () => {
  const bindings = env({
    OPENAI_API_KEY: "key",
    ACCESS_TEAM_DOMAIN: "https://team.cloudflareaccess.com",
    ACCESS_POLICY_AUD: "aud",
  });
  const response = await call(
    new Request("https://potterycoach.example/api/realtime/session", {
      method: "POST",
      headers: { origin: "https://potterycoach.example", "content-type": "application/json" },
      body: "{}",
    }),
    bindings,
  );
  expect(response.status).toBe(401);
});

it("syncs the throw log for the signed-in potter", async () => {
  const sync = (body: unknown, url = "http://localhost/api/sync") =>
    call(
      new Request(url, {
        method: "POST",
        headers: { origin: new URL(url).origin, "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  const response = await sync({ since: 0, pieces: [{ id: "p1", updatedAtMs: 1 }], notes: [] });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ pieces: [{ id: "p1" }] });
  expect((await sync({ since: 0, pieces: [], notes: [] }, "https://potterycoach.example/api/sync")).status).toBe(401);
});
