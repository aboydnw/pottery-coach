import { expect, test } from "@playwright/test";

test("camera interruption is explicit and requires user resume", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /begin private setup/i }).click();
  await page.getByRole("button", { name: "Start camera" }).click();
  await expect(page.getByRole("button", { name: "Stop camera" })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByText(/readings are stale/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /resume/i })).toBeVisible();
});

test("orientation change and offline state preserve explicit controls", async ({ page, context }) => {
  await page.goto("/"); await page.getByRole("button", { name: /begin private setup/i }).click();
  await page.setViewportSize({ width: 844, height: 390 });
  await context.setOffline(true);
  await expect(page.getByRole("button", { name: /start camera/i })).toBeVisible();
  await context.setOffline(false);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: /start camera/i })).toBeVisible();
});
