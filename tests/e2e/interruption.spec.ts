import { expect, test } from "@playwright/test";

test("an interrupted camera becomes stale until explicitly resumed", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start camera" }).click();
  await expect(page.getByRole("button", { name: "Stop camera" })).toBeVisible();

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });

  await expect(page.getByRole("status")).toContainText(/readings are stale/i);
  await page.getByRole("button", { name: /resume camera/i }).click();
  await expect(page.getByRole("status")).toHaveCount(0);
});
