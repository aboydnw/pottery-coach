import { expect, test } from "@playwright/test";
import { endSession, openSetup, startSession } from "./fixtures/session-streams";

test("skipping sizes keeps a shape-only session that never shows millimetres", async ({ page }) => {
  await startSession(page, { demo: false });
  await openSetup(page);
  await page.getByRole("button", { name: /skip sizes/i }).click();
  await expect(page.locator(".setup-checklist")).toContainText(/skipped \(shape only\)/i);
  await expect(page.getByRole("region", { name: /live measurements/i })).not.toContainText("cm");
  await endSession(page);
  await expect(page.getByRole("table", { name: /measurement data/i })).not.toContainText("mm");
});

test("starts on the front camera and can switch to the rear camera", async ({ page }) => {
  await startSession(page, { demo: false });
  await expect(page.getByLabel("Front camera preview")).toBeVisible();
  await openSetup(page);
  await page.getByRole("button", { name: /use rear camera/i }).click();
  await expect(page.getByLabel("Rear camera preview")).toBeVisible();
  await expect(page.getByRole("button", { name: /use front camera/i })).toBeVisible();
});
