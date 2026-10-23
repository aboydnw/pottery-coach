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

test("a lost voice connection asks for one tap anywhere, which tries again", async ({ page }) => {
  test.setTimeout(60_000);
  let attempts = 0;
  await page.route("**/api/realtime/session", (route) => {
    attempts += 1;
    return route.fulfill({ status: 502, json: { error: "VOICE_PROVIDER_ERROR" } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /start session/i }).click();

  const tapAnywhere = page.getByRole("button", { name: /tap anywhere once to reconnect/i });
  await expect(tapAnywhere).toBeVisible({ timeout: 30_000 });
  const before = attempts;
  await tapAnywhere.click();
  await expect.poll(() => attempts).toBeGreaterThan(before);
});
