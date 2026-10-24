import { expect, test } from "@playwright/test";
import { beginDemoSession, confirmWetGoal, endSession } from "./fixtures/session-streams";

test("ending stops capture and deletion displays every local inventory class", async ({ page }) => {
  await beginDemoSession(page);
  await confirmWetGoal(page);
  await endSession(page);
  await expect(page.getByText(/camera active.*frames stay/i)).toHaveCount(0);
  await page.getByRole("button", { name: /^delete session$/i }).click();
  await page.getByRole("button", { name: /confirm deletion/i }).click();
  await expect(page.getByRole("heading", { name: /ready at the wheel/i })).toBeVisible();
  for (const store of ["indexeddb", "cache-storage", "local-blobs", "sync-queue", "provider-exception"])
    await expect(page.getByText(new RegExp(store))).toBeVisible();
});
