import { expect, test } from "@playwright/test";
import { openSetup, startSession } from "./fixtures/session-streams";

test("without a voice coach, setup stays reachable by touch and nothing claims to be listening", async ({ page }) => {
  await startSession(page, { demo: false });
  await openSetup(page);
  await expect(page.getByRole("heading", { name: /calibrate with the printed page/i })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /wheel-head diameter in inches/i })).toBeVisible();
  await page.getByRole("button", { name: /optional wheel-head detection/i }).click();
  await expect(page.getByRole("button", { name: "14 in", exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(/switched off/i);
  await expect(page.getByRole("region", { name: /conversation/i })).toHaveCount(0);
  await expect(page.getByText(/proactive wobble/i)).toHaveCount(0);
});
