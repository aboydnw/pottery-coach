import { expect, test } from "@playwright/test";
import { endSession, startSession } from "./fixtures/session-streams";

test("the camera starts only after the single tap and stops when the session ends", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/camera active/i)).toHaveCount(0);
  await startSession(page, { demo: false });
  await endSession(page);
  await expect(page.getByText(/camera active/i)).toHaveCount(0);
});
