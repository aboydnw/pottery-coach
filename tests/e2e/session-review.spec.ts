import { expect, test } from "@playwright/test";
import { beginDemoSession, confirmWetGoal, endSession } from "./fixtures/session-streams";

test("review keeps measurements linked to recorded evidence", async ({ page }) => {
  await beginDemoSession(page);
  await confirmWetGoal(page);
  await endSession(page);
  await expect(page.getByRole("table", { name: /measurement data/i })).toContainText("120 mm");
  await expect(page.getByText(/missing or low-confidence periods remain blank/i)).toBeVisible();
});
