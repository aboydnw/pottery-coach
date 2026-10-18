import { expect, test } from "@playwright/test";
import { startSession } from "./fixtures/session-streams";

test("without a voice coach, setup stays reachable by touch and nothing claims to be listening", async ({ page }) => {
  await startSession(page, { demo: false });
  await expect(page.getByRole("region", { name: /session settings/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "14 in", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: /conversation/i })).toContainText(/switched off/i);
  await expect(page.getByRole("region", { name: /conversation/i })).not.toContainText(/listening/i);
  await expect(page.getByText(/proactive wobble/i)).toHaveCount(0);
});
