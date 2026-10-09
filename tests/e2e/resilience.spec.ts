import { expect, test } from "@playwright/test";

test("camera interruption is explicit and requires user resume", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start camera" }).click();
  await expect(page.getByRole("button", { name: "Stop camera" })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByRole("status")).toContainText(/stale/i);
  await expect(page.getByRole("button", { name: /resume/i })).toBeVisible();
});
