import { expect, test } from "@playwright/test";
import { beginDemoSession, chooseNoVoiceAndConfirmWetGoal } from "./fixtures/session-streams";

test("review keeps measurements linked to recorded evidence", async ({ page }) => {
  await beginDemoSession(page); await chooseNoVoiceAndConfirmWetGoal(page);
  await page.getByRole("button", { name: /end session and review/i }).click();
  await expect(page.getByRole("table", { name: /measurement data/i })).toContainText("120 mm");
  await expect(page.getByText(/missing or low-confidence periods remain blank/i)).toBeVisible();
});
