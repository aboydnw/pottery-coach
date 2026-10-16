import { expect, test } from "@playwright/test";
import { startSession } from "./fixtures/session-streams";

test("an interrupted camera asks for one tap and recovers when it gets it", async ({ page }) => {
  await startSession(page, { demo: false });
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByText(/the camera stopped/i)).toBeVisible();
  await page.getByRole("button", { name: /resume camera/i }).click();
  await expect(page.getByText(/the camera stopped/i)).toHaveCount(0);
});
