import { expect, test } from "./fixtures/playwright";
import { beginDemoSession } from "./fixtures/session-streams";

test("keeps visual setup available while cloud and proactive features remain gated", async ({ page }) => {
  await beginDemoSession(page);
  await expect(page.getByText(/cloud voice remains disabled/i)).toBeVisible();
  await page.getByRole("button", { name: /continue without voice/i }).click();
  await expect(page.getByRole("heading", { name: /choose a target/i })).toBeVisible();
  await expect(page.getByText(/proactive wobble/i)).toHaveCount(0);
});
