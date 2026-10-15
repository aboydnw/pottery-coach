import { expect, test, type Page } from "@playwright/test";
import { beginDemoSession, confirmWetGoal, endSession, openSetup, startSession } from "./fixtures/session-streams";

async function completeSession(page: Page) {
  await confirmWetGoal(page);
  await endSession(page);
}

test("a second session after deletion records and reviews normally", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await beginDemoSession(page);
  await completeSession(page);
  await page.getByRole("button", { name: /^delete session$/i }).click();
  await page.getByRole("button", { name: /confirm deletion/i }).click();
  await page.getByRole("button", { name: /start another session/i }).click();

  await page.getByRole("button", { name: /start session/i }).click();
  await openSetup(page);
  await page.getByRole("button", { name: /load deterministic demo calibration/i }).click();
  await completeSession(page);

  await expect(page.getByRole("table", { name: /measurement data/i })).toContainText("120 mm");
  expect(errors).toEqual([]);
});

test("review times are relative to the session start", async ({ page }) => {
  await beginDemoSession(page);
  await completeSession(page);
  const firstTime = await page.locator("table tbody tr td").first().innerText();
  expect(Number.parseFloat(firstTime)).toBeLessThan(3600);
});

test("measurement runs from the first tap, before calibration, even with the preview scrolled away", async ({
  page,
}) => {
  await page.setViewportSize({ width: 412, height: 500 });
  await startSession(page, { demo: false });
  await page.locator("details.diagnostics summary").click();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.locator("video")).not.toBeInViewport();
  await page.waitForTimeout(6_000);
  const samples: number[] = [];
  for (let index = 0; index < 4; index += 1) {
    const text = await page.locator("details.diagnostics dl").innerText();
    samples.push(Number(/Processed\s+([\d.]+)/.exec(text)?.[1] ?? Number.NaN));
    await page.waitForTimeout(1_500);
  }
  expect(samples.every((fps) => fps > 0)).toBe(true);
});
