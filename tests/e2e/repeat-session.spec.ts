import { expect, test, type Page } from "@playwright/test";
import { beginDemoSession, confirmWetGoal, endSession, openSetup, startSession } from "./fixtures/session-streams";

async function completeSession(page: Page) {
  await confirmWetGoal(page);
  await endSession(page);
}

test("a new session preserves the completed session in history", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await beginDemoSession(page);
  await completeSession(page);
  await page.getByRole("button", { name: /start new session/i }).click();
  await openSetup(page);
  await page.getByRole("button", { name: /load deterministic demo calibration/i }).click();
  await expect(page.getByRole("region", { name: /live measurements/i })).toContainText("12.0 cm");
  await completeSession(page);

  await expect(page.getByRole("heading", { name: /throw complete/i })).toBeVisible();
  await page.getByRole("button", { name: /go home/i }).click();
  await expect(page.getByRole("heading", { name: /past sessions/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /open session/i })).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("review times are relative to the session start", async ({ page }) => {
  await beginDemoSession(page);
  await completeSession(page);
  const firstTime = await page.locator("table tbody tr td").first().innerText();
  expect(Number.parseFloat(firstTime)).toBeLessThan(3600);
});

test("measurement runs from the first tap, before calibration, even with settings covering the preview", async ({
  page,
}) => {
  await page.setViewportSize({ width: 412, height: 500 });
  await startSession(page, { demo: false });
  // Chrome pauses muted autoplay videos once they're hidden, which stopped measurement.
  await expect(page.locator("video")).not.toHaveAttribute("autoplay");
  await openSetup(page);
  await page.locator("details.diagnostics summary").click();
  await page.waitForTimeout(6_000);
  const samples: number[] = [];
  for (let index = 0; index < 4; index += 1) {
    const text = await page.locator("details.diagnostics dl").innerText();
    samples.push(Number(/Processed\s+([\d.]+)/.exec(text)?.[1] ?? Number.NaN));
    await page.waitForTimeout(1_500);
  }
  expect(samples.every((fps) => fps > 0)).toBe(true);
});
