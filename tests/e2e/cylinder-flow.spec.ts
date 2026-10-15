import { expect, test } from "@playwright/test";
import { beginDemoSession, confirmWetGoal, endSession, voiceTool } from "./fixtures/session-streams";

test("completes an evidence-linked cylinder session through review and deletion", async ({ page }) => {
  await beginDemoSession(page);
  await confirmWetGoal(page);
  await expect(page.getByRole("region", { name: /live target comparison/i })).toBeVisible();
  await expect(page.getByRole("region", { name: /live measurements/i })).toContainText("12.0 cm");
  await expect(voiceTool(page, "getCurrentDimensions")).resolves.toMatchObject({
    heightMm: 120,
    evidenceId: "demo-reading-1",
  });
  await page.getByRole("button", { name: /mark this moment/i }).click();
  await expect(page.getByText(/moment marked locally/i)).toBeVisible();
  await endSession(page);
  await expect(page.getByRole("table", { name: /measurement data/i })).toContainText("120 mm");
  await page.getByRole("button", { name: /^delete session$/i }).click();
  await page.getByRole("button", { name: /confirm deletion/i }).click();
  await expect(page.getByRole("heading", { name: /session deleted/i })).toBeVisible();
});
