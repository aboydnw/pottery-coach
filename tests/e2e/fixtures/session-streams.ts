import type { Page } from "@playwright/test";

export async function beginDemoSession(page: Page) {
  await page.goto("/?mode=demo");
  await page.getByRole("button", { name: /begin private setup/i }).click();
  await page.getByRole("button", { name: /start camera/i }).click();
  await page.getByRole("button", { name: /load deterministic demo calibration/i }).click();
  await page.getByLabel(/100 mm line/i).check();
  await page.getByRole("button", { name: /use calibration/i }).click();
}

export async function chooseNoVoiceAndConfirmWetGoal(page: Page) {
  await page.getByRole("button", { name: /continue without voice/i }).click();
  await page.getByRole("button", { name: /review goal/i }).click();
  await page.getByRole("button", { name: /confirm goal/i }).click();
}
