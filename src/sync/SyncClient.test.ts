import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { ThrowLog } from "../pieces/ThrowLog";
import { SyncClient } from "./SyncClient";

const logs: ThrowLog[] = [];

function setup(respond: (body: { since: number; pieces: unknown[]; notes: unknown[] }) => Response) {
  const log = new ThrowLog(`sync-${Math.random()}`);
  logs.push(log);
  const sent: Array<{ since: number; pieces: Array<Record<string, unknown>>; notes: unknown[] }> = [];
  const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    sent.push(body);
    return respond(body);
  });
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  };
  return { log, sent, client: new SyncClient(log, fetchImpl as typeof fetch, storage) };
}

afterEach(async () => {
  await Promise.all(logs.splice(0).map((log) => log.destroy()));
});

it("pushes unsynced rows, then remembers where it got to", async () => {
  const { log, sent, client } = setup(() => Response.json({ serverTime: 500, pieces: [], notes: [] }));
  await log.rememberNote("Working on thinner walls");
  expect(await client.sync()).toBe("synced");
  expect(sent[0]).toMatchObject({ since: 0, notes: [{ text: "Working on thinner walls" }] });
  expect(sent[0]?.notes[0]).not.toHaveProperty("syncedAtMs");
  expect(await log.unsynced()).toEqual({ pieces: [], notes: [] });
  await client.sync();
  expect(sent[1]).toMatchObject({ since: 500, notes: [] });
});

it("brings in notes added on another device", async () => {
  const remote = { id: "n9", text: "Use inches", createdAtMs: 1, updatedAtMs: 2, syncedAtMs: null };
  const { log, client } = setup(() => Response.json({ serverTime: 10, pieces: [], notes: [remote] }));
  await client.sync();
  expect((await log.listNotes()).map((note) => note.text)).toEqual(["Use inches"]);
});

it("keeps changes for later when offline or signed out", async () => {
  const offline = setup(() => {
    throw new TypeError("network down");
  });
  await offline.log.rememberNote("Keep me");
  expect(await offline.client.sync()).toBe("offline");
  expect((await offline.log.unsynced()).notes).toHaveLength(1);

  const signedOut = setup(() => new Response(null, { status: 401 }));
  expect(await signedOut.client.sync()).toBe("signed-out");
});
