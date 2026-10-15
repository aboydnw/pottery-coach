import { expect, test, type Page } from "@playwright/test";
import { WHEEL_SCENE } from "./support/boardVideo";

async function sliderValue(page: Page, name: RegExp): Promise<number> {
  return Number(await page.getByRole("slider", { name }).getAttribute("aria-valuenow"));
}

test("calibrates from the wheel head: asks the size, finds the edges, and moves on", async ({ page }) => {
  await page.goto("/?mode=demo");
  await page.getByRole("button", { name: /begin private setup/i }).click();
  await page.getByRole("button", { name: /start camera/i }).click();
  await page.getByRole("button", { name: "14 in", exact: true }).click();
  await page.getByRole("button", { name: /find 14 in wheel head/i }).click();

  await expect(page.getByRole("heading", { name: /check the wheel-head edges/i })).toBeVisible();
  expect(Math.abs((await sliderValue(page, /left edge/i)) - WHEEL_SCENE.leftX)).toBeLessThanOrEqual(10);
  expect(Math.abs((await sliderValue(page, /right edge/i)) - WHEEL_SCENE.rightX)).toBeLessThanOrEqual(10);
  await page.getByRole("button", { name: /looks right/i }).click();

  await expect(page.getByRole("heading", { name: /choose voice coaching/i })).toBeVisible();
  await page.locator("details.diagnostics summary").click();
  await page.waitForTimeout(4_000);
  const text = await page.locator("details.diagnostics dl").innerText();
  expect(Number(/Processed\s+([\d.]+)/.exec(text)?.[1])).toBeGreaterThan(0);
});

test("remembers the wheel size on this device", async ({ page }) => {
  await page.goto("/?mode=demo");
  await page.evaluate(() => localStorage.setItem("pottery-coach-wheel-head-mm", "330.2"));
  await page.reload();
  await page.getByRole("button", { name: /begin private setup/i }).click();
  await page.getByRole("button", { name: /start camera/i }).click();
  await expect(page.getByRole("button", { name: "13 in", exact: true })).toHaveAttribute("aria-pressed", "true");
});
