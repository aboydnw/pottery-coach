import { expect, test } from "./fixtures/playwright";
import { beginDemoSession } from "./fixtures/session-streams";

test("offline mock voice is pausable, resumable, and independently endable", async ({ page }) => {
  await beginDemoSession(page);
  await page.getByRole("button", { name: /use offline mock voice/i }).click();
  await expect(page.getByText(/microphone: listening/i)).toBeVisible();
  await page.getByRole("button", { name: /pause listening/i }).click();
  await expect(page.getByText(/microphone: paused/i)).toBeVisible();
  await page.getByRole("button", { name: /resume listening/i }).click();
  await page.getByRole("button", { name: /end voice/i }).click();
  await expect(page.getByText(/voice session ended.*camera measurements continue/i)).toBeVisible();
});
