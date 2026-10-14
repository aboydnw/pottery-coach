import { expect, test, type Page } from "@playwright/test";

async function processedFps(page: Page): Promise<number> {
  const text = await page.locator("details.diagnostics dl").innerText();
  return Number(/Processed\s+([\d.]+)/.exec(text)?.[1] ?? Number.NaN);
}

test("calibrates from the printed board with the real AprilTag detector and keeps processing frames", async ({
  page,
}) => {
  await page.goto("/?mode=demo");
  await page.getByRole("button", { name: /begin private setup/i }).click();
  await page.getByRole("button", { name: /start camera/i }).click();
  await page.getByRole("button", { name: /calibrate printed board/i }).click();

  await expect(page.getByRole("heading", { name: /confirm calibration/i })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("list", { name: /calibration problems/i })).toHaveCount(0);
  await page.getByLabel(/100 mm line/i).check();
  await page.getByRole("button", { name: /use calibration/i }).click();
  await expect(page.getByRole("heading", { name: /choose voice coaching/i })).toBeVisible();

  await page.locator("details.diagnostics summary").click();
  await page.waitForTimeout(4_000);
  const samples: number[] = [];
  for (let index = 0; index < 4; index += 1) {
    samples.push(await processedFps(page));
    await page.waitForTimeout(1_500);
  }
  expect(samples.every((fps) => fps > 0)).toBe(true);
});
