import { expect, test } from "./fixtures/playwright";

test("an interrupted camera becomes stale until explicitly resumed", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /begin private setup/i }).click();
  await page.getByRole("button", { name: "Start camera" }).click();
  await expect(page.getByRole("button", { name: "Stop camera" })).toBeVisible();

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });

  await expect(page.getByText(/readings are stale/i)).toBeVisible();
  await page.getByRole("button", { name: /resume camera/i }).click();
  await expect(page.getByText(/readings are stale/i)).toHaveCount(0);
});
