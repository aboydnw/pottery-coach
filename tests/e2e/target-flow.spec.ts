import { expect, test } from "./fixtures/playwright";
import { beginDemoSession } from "./fixtures/session-streams";

test("target flow exposes wet/fired assumptions before confirmation", async ({ page }) => {
  await beginDemoSession(page); await page.getByRole("button", { name: /continue without voice/i }).click();
  await page.getByLabel("Goal basis").selectOption("fired");
  await page.getByRole("button", { name: /review goal/i }).click();
  await expect(page.getByRole("alert")).toContainText(/shrinkage/i);
  await page.getByLabel("Goal basis").selectOption("wet");
  await page.getByRole("button", { name: /review goal/i }).click();
  await expect(page.getByText(/no universal clay shrinkage is assumed/i)).toBeVisible();
});
