import { expect, test, type Page } from "@playwright/test";
import { openSetup, startSession, voiceTool } from "./fixtures/session-streams";
import { WHEEL_SCENE } from "./support/boardVideo";

async function sliderValue(page: Page, name: RegExp): Promise<number> {
  return Number(await page.getByRole("slider", { name }).getAttribute("aria-valuenow"));
}

test("calibrates from the wheel head by touch: size, edges, confirm", async ({ page }) => {
  await startSession(page);
  await openSetup(page);
  await page.getByRole("button", { name: "14 in", exact: true }).click();
  await page.getByRole("button", { name: /find 14 in wheel head/i }).click();

  await expect(page.getByRole("heading", { name: /check the wheel-head edges/i })).toBeVisible();
  expect(Math.abs((await sliderValue(page, /left edge/i)) - WHEEL_SCENE.leftX)).toBeLessThanOrEqual(10);
  expect(Math.abs((await sliderValue(page, /right edge/i)) - WHEEL_SCENE.rightX)).toBeLessThanOrEqual(10);
  await page.getByRole("button", { name: /looks right/i }).click();
  await expect(page.locator("details.setup-checklist summary")).toContainText(/sizes are in centimetres/i);
});

test("calibrates from the wheel head entirely by voice", async ({ page }) => {
  await startSession(page);
  await voiceTool(page, "proposeSetup", { wheelHeadDiameter: { value: 14, unit: "in" } });
  await voiceTool(page, "confirmSetup");
  await expect(voiceTool(page, "checkWheelHead")).resolves.toMatchObject({ found: true });
  const before = await sliderValue(page, /left edge/i);
  await voiceTool(page, "adjustWheelMarker", { side: "left", direction: "out", size: "small" });
  await expect.poll(() => sliderValue(page, /left edge/i)).toBeLessThan(before);
  await voiceTool(page, "adjustWheelMarker", { side: "left", direction: "in", size: "small" });
  await expect(voiceTool(page, "confirmWheelHead")).resolves.toMatchObject({ accepted: true });
  await expect(page.locator("details.setup-checklist summary")).toContainText(/sizes are in centimetres/i);
  await expect(page.getByRole("heading", { name: /check the wheel-head edges/i })).toHaveCount(0);
});

test("remembers the wheel size on this device", async ({ page }) => {
  await page.goto("/?mode=demo");
  await page.evaluate(() => localStorage.setItem("pottery-coach-wheel-head-mm", "330.2"));
  await startSession(page);
  await openSetup(page);
  await expect(page.getByRole("button", { name: "13 in", exact: true })).toHaveAttribute("aria-pressed", "true");
});
