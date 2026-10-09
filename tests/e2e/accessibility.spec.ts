import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures/playwright";

test("critical setup screen has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: /begin private setup/i })).toBeFocused();
});

test("remains usable at narrow mobile width and 200% zoom proxy", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await expect(page.getByRole("button", { name: /begin private setup/i })).toBeVisible();
  expect(await page.locator("body").evaluate((body) => body.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const box = await page.getByRole("button", { name: /begin private setup/i }).boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
});

test("respects reduced motion and communicates state without color alone", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/");
  await expect(page.getByText(/raw video is not stored or uploaded/i)).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).not.toBe("smooth");
});
