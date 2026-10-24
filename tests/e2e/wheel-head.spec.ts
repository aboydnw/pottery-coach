import { expect, test, type Page } from "@playwright/test";
import { openSetup, startSession, voiceTool } from "./fixtures/session-streams";
import { WHEEL_SCENE } from "./support/boardVideo";

async function sliderValue(page: Page, name: RegExp): Promise<number> {
  return Number(await page.getByRole("slider", { name }).inputValue());
}

test("calibrates from the wheel head by touch: size, ellipse, confirm", async ({ page }) => {
  await startSession(page);
  await openSetup(page);
  await page.getByRole("button", { name: "14 in", exact: true }).click();
  await page.getByRole("button", { name: /find 14 in wheel head/i }).click();

  await expect(page.getByRole("region", { name: /live wheel-head calibration/i })).toBeVisible();
  await expect(page.locator(".wheel-live-overlay canvas, .wheel-live-overlay img")).toHaveCount(0);
  await page.getByRole("button", { name: /adjust manually/i }).click();
  expect(
    Math.abs((await sliderValue(page, /wheel center horizontal/i)) - (WHEEL_SCENE.leftX + WHEEL_SCENE.rightX) / 2),
  ).toBeLessThanOrEqual(10);
  expect(
    Math.abs((await sliderValue(page, /wheel width/i)) - (WHEEL_SCENE.rightX - WHEEL_SCENE.leftX)),
  ).toBeLessThanOrEqual(15);
  await page.getByRole("button", { name: /use this outline/i }).click();
  await openSetup(page);
  await expect(page.locator(".setup-summary")).toContainText(/sizes are in centimetres/i);
});

test("calibrates from the wheel head entirely by voice", async ({ page }) => {
  await startSession(page);
  await voiceTool(page, "proposeSetup", { wheelHeadDiameter: { value: 14, unit: "in" } });
  await voiceTool(page, "confirmSetup");
  await expect(voiceTool(page, "checkWheelHead")).resolves.toMatchObject({ found: true });
  await page.getByRole("button", { name: /adjust manually/i }).click();
  const before = await sliderValue(page, /wheel width/i);
  await voiceTool(page, "adjustWheelMarker", { side: "left", direction: "out", size: "small" });
  await expect.poll(() => sliderValue(page, /wheel width/i)).toBeGreaterThan(before);
  await voiceTool(page, "adjustWheelMarker", { side: "left", direction: "in", size: "small" });
  await expect(voiceTool(page, "confirmWheelHead")).resolves.toMatchObject({ accepted: true });
  await openSetup(page);
  await expect(page.locator(".setup-summary")).toContainText(/sizes are in centimetres/i);
  await expect(page.getByRole("region", { name: /live wheel-head calibration/i })).toHaveCount(0);
});

test("remembers the wheel size on this device", async ({ page }) => {
  await page.goto("/?mode=demo");
  await page.evaluate(() => localStorage.setItem("pottery-coach-wheel-head-mm", "330.2"));
  await startSession(page);
  await openSetup(page);
  await expect(page.getByRole("button", { name: "13 in", exact: true })).toHaveAttribute("aria-pressed", "true");
});
