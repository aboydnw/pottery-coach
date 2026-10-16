import { expect, test } from "@playwright/test";
import { endSession, startSession } from "./fixtures/session-streams";

test("mock camera soak keeps the page alive and capture explicitly bounded", async ({ page }) => {
  const durationMs = Number(process.env.SOAK_MS ?? 2_000);
  await startSession(page, { demo: false });
  await page.waitForTimeout(durationMs);
  await expect(page.getByText(/camera active.*frames stay/i)).toBeVisible();
  await endSession(page);
  await expect(page.getByText(/camera active.*frames stay/i)).toHaveCount(0);
});
