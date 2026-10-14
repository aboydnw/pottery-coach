import { expect, test } from "@playwright/test";
import { beginDemoSession, chooseNoVoiceAndConfirmWetGoal } from "./fixtures/session-streams";

test("local databases hold measurements but no raw media after a session", async ({ page }) => {
  await beginDemoSession(page);
  await chooseNoVoiceAndConfirmWetGoal(page);
  await page.getByRole("button", { name: /mark this moment/i }).click();
  await page.getByRole("button", { name: /end session and review/i }).click();
  await expect(page.getByText(/camera active.*frames stay/i)).toHaveCount(0);

  const contents = await page.evaluate(async () => {
    const summary: Array<{ store: string; rows: number; binary: number; largestRowBytes: number }> = [];
    for (const { name } of await indexedDB.databases()) {
      if (!name) continue;
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.addEventListener("success", () => resolve(request.result));
        request.addEventListener("error", () => reject(request.error));
      });
      for (const store of Array.from(database.objectStoreNames)) {
        const rows = await new Promise<unknown[]>((resolve, reject) => {
          const request = database.transaction(store).objectStore(store).getAll();
          request.addEventListener("success", () => resolve(request.result));
          request.addEventListener("error", () => reject(request.error));
        });
        const isBinary = (value: unknown): boolean =>
          value instanceof Blob ||
          value instanceof ArrayBuffer ||
          ArrayBuffer.isView(value) ||
          (typeof value === "object" && value !== null && Object.values(value).some(isBinary));
        summary.push({
          store,
          rows: rows.length,
          binary: rows.filter(isBinary).length,
          largestRowBytes: Math.max(0, ...rows.map((row) => JSON.stringify(row).length)),
        });
      }
      database.close();
    }
    return summary;
  });

  expect(contents.find((entry) => entry.store === "readings")?.rows).toBeGreaterThan(0);
  expect(contents.every((entry) => entry.binary === 0)).toBe(true);
  expect(Math.max(...contents.map((entry) => entry.largestRowBytes))).toBeLessThan(20_000);
});
