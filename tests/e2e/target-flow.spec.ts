import { expect, test } from "@playwright/test";
import { beginDemoSession } from "./fixtures/session-streams";

test("the touch goal form exposes wet/fired assumptions before confirmation", async ({ page }) => {
  await beginDemoSession(page);
  await page.getByLabel("Goal basis").selectOption("fired");
  await page.getByRole("button", { name: /review goal/i }).click();
  await expect(page.locator("details.setup-checklist").getByRole("alert")).toContainText(/shrinkage/i);
  await page.getByLabel("Goal basis").selectOption("wet");
  await page.getByRole("button", { name: /review goal/i }).click();
  await expect(page.getByText(/no universal clay shrinkage is assumed/i)).toBeVisible();
});
