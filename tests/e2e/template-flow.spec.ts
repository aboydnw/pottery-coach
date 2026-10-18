import { expect, test } from "@playwright/test";
import { beginDemoSession } from "./fixtures/session-streams";

test("confirms a fired tapered target with an explicit shrinkage equation", async ({ page }) => {
  await beginDemoSession(page);
  await page.getByLabel("Target shape").selectOption("tapered-cylinder-v1");
  await page.getByLabel("Goal basis").selectOption("fired");
  await page.getByLabel("Desired height").fill("300");
  await page.getByLabel("Shrinkage percent").fill("12");
  await page.getByRole("button", { name: /review goal/i }).click();
  await expect(page.getByText(/340\.91/)).toBeVisible();
  await page.getByRole("button", { name: /confirm goal/i }).click();
  await expect(page.locator(".setup-summary")).toContainText(/tapered cylinder, goal 30 cm fired/i);
  await expect(page.getByRole("region", { name: /live target comparison/i })).toBeVisible();
});
