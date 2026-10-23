import { expect, test } from "@playwright/test";

test("a refused sign-in is explained and the session carries on by touch", async ({ page }) => {
  await page.route("**/api/realtime/session", (route) =>
    route.fulfill({ status: 401, json: { error: "VOICE_PROVIDER_ERROR" } }),
  );
  await page.goto("/");
  await expect(page.getByLabel(/passphrase/i)).toHaveCount(0);
  await page.getByRole("button", { name: /start session/i }).click();

  await expect(page.getByRole("region", { name: /conversation/i })).toContainText(/isn't available for this account/i);
  await expect(page.getByRole("button", { name: /tap anywhere/i })).toHaveCount(0);
  await expect(page.getByText(/camera active/i)).toBeVisible();
});

test("a lost voice connection offers reconnect without blocking the camera controls", async ({ page }) => {
  test.setTimeout(60_000);
  let attempts = 0;
  await page.route("**/api/realtime/session", (route) => {
    attempts += 1;
    return route.fulfill({ status: 502, json: { error: "VOICE_PROVIDER_ERROR" } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /start session/i }).click();

  const reconnect = page.getByRole("button", { name: /reconnect voice/i });
  await expect(reconnect).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
  const before = attempts;
  await reconnect.click();
  await expect.poll(() => attempts).toBeGreaterThan(before);
});
