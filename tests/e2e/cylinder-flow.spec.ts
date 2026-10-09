import { expect, test } from "./fixtures/playwright";
import { beginDemoSession, chooseNoVoiceAndConfirmWetGoal } from "./fixtures/session-streams";

test("completes an evidence-linked cylinder session through review and deletion", async ({ page }) => {
  await beginDemoSession(page);
  await chooseNoVoiceAndConfirmWetGoal(page);
  await page.getByRole("button", { name: /how tall/i }).click();
  await expect(page.getByText(/height is 120 mm.*demo-reading-1/i)).toBeVisible();
  await expect(page.getByRole("region", { name: /live target comparison/i })).toBeVisible();
  await page.getByRole("button", { name: /mark this moment/i }).click();
  await expect(page.getByText(/moment marked locally/i)).toBeVisible();
  await page.getByRole("button", { name: /end session and review/i }).click();
  await expect(page.getByRole("heading", { name: /throw complete/i })).toBeVisible();
  await expect(page.getByRole("table", { name: /measurement data/i })).toContainText("120 mm");
  await page.getByRole("button", { name: /^delete session$/i }).click();
  await page.getByRole("button", { name: /confirm deletion/i }).click();
  await expect(page.getByRole("heading", { name: /session deleted/i })).toBeVisible();
});
