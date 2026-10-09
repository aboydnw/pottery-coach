import { expect, test } from "./fixtures/playwright";
import { beginDemoSession } from "./fixtures/session-streams";

test("confirms a fired tapered template with an explicit shrinkage equation", async ({ page }) => {
  await beginDemoSession(page);
  await page.getByRole("button", { name: /continue without voice/i }).click();
  await page.getByLabel("Template").selectOption("tapered-cylinder-v1");
  await page.getByLabel("Goal basis").selectOption("fired");
  await page.getByLabel("Desired height").fill("300");
  await page.getByLabel("Shrinkage percent").fill("12");
  await page.getByRole("button", { name: /review goal/i }).click();
  await expect(page.getByText(/340\.91/)).toBeVisible();
  await page.getByRole("button", { name: /confirm goal/i }).click();
  await expect(page.getByRole("region", { name: /live target comparison/i })).toBeVisible();
});
