import { expect, test } from "@playwright/test";
import { beginDemoSession, chooseNoVoiceAndConfirmWetGoal } from "./fixtures/session-streams";

test("ending stops capture and deletion displays every local inventory class", async ({ page }) => {
  await beginDemoSession(page); await chooseNoVoiceAndConfirmWetGoal(page);
  await expect(page.getByText(/camera active.*frames stay/i)).toBeVisible();
  await page.getByRole("button", { name: /end session and review/i }).click();
  await expect(page.getByText(/camera active.*frames stay/i)).toHaveCount(0);
  await page.getByRole("button", { name: /^delete session$/i }).click();
  await page.getByRole("button", { name: /confirm deletion/i }).click();
  for (const store of ["indexeddb", "cache-storage", "local-blobs", "sync-queue", "provider-exception"])
    await expect(page.getByText(new RegExp(store))).toBeVisible();
});
