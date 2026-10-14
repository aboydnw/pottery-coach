import { expect, test } from "@playwright/test";

test("continues without a printed board into a shape-only session", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /begin private setup/i }).click();
  await page.getByRole("button", { name: /start camera/i }).click();
  await page.getByRole("button", { name: /continue without calibration/i }).click();
  await page.getByRole("button", { name: /continue without voice/i }).click();
  await expect(page.getByLabel(/desired height/i)).toHaveCount(0);
  await page.getByRole("button", { name: /start shape-only session/i }).click();

  await expect(page.getByRole("region", { name: /live shape comparison/i })).toContainText(
    /sizes and wobble need a calibrated camera/i,
  );
  await page.getByRole("button", { name: /end session and review/i }).click();
  await expect(page.getByRole("heading", { name: /throw complete/i })).toBeVisible();
  await expect(page.getByRole("table", { name: /measurement data/i })).not.toContainText("mm");
});

test("starts on the front camera and can switch to the rear camera", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /begin private setup/i }).click();
  await page.getByRole("button", { name: /start camera/i }).click();
  await expect(page.getByLabel("Front camera preview")).toBeVisible();
  await page.getByRole("button", { name: /use rear camera/i }).click();
  await expect(page.getByLabel("Rear camera preview")).toBeVisible();
  await expect(page.getByRole("button", { name: /use front camera/i })).toBeVisible();
});
