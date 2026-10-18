import { expect, test } from "@playwright/test";
import { startSession } from "./fixtures/session-streams";

test("orientation changes and going offline keep the session and its controls", async ({ page, context }) => {
  await startSession(page, { demo: false });
  await page.setViewportSize({ width: 844, height: 390 });
  await context.setOffline(true);
  await expect(page.getByRole("button", { name: /^end session$/i })).toBeVisible();
  await context.setOffline(false);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText(/camera active/i)).toBeVisible();
});
