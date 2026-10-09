import { expect, test } from "@playwright/test";

test("mock camera soak keeps the page alive and capture explicitly bounded", async ({ page }) => {
  const durationMs = Number(process.env.SOAK_MS ?? 2_000);
  await page.goto("/"); await page.getByRole("button", { name: /begin private setup/i }).click();
  await page.getByRole("button", { name: /start camera/i }).click();
  await expect(page.getByRole("button", { name: /stop camera/i })).toBeVisible();
  await page.waitForTimeout(durationMs);
  await expect(page.getByText(/camera active.*frames stay/i)).toBeVisible();
  await page.getByRole("button", { name: /stop camera/i }).click();
  await expect(page.getByText(/camera active.*frames stay/i)).toHaveCount(0);
});
