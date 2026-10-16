import { expect, test } from "@playwright/test";

test("a refused passphrase is explained and the session carries on by touch", async ({ page }) => {
  await page.route("**/api/realtime/session", (route) =>
    route.fulfill({ status: 401, json: { error: "VOICE_PROVIDER_ERROR" } }),
  );
  await page.goto("/");
  await page.getByLabel(/voice passphrase/i).fill("wrong-words");
  await page.getByRole("button", { name: /turn on voice coach/i }).click();
  await expect(page.getByText(/voice coach is on for this phone/i)).toBeVisible();
  await page.getByRole("button", { name: /start session/i }).click();

  await expect(page.getByRole("region", { name: /conversation/i })).toContainText(/passphrase didn't work/i);
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
  await page.evaluate(() => localStorage.setItem("pottery-coach-voice-passphrase", "field-test"));
  await page.reload();
  await page.getByRole("button", { name: /start session/i }).click();

  const tapAnywhere = page.getByRole("button", { name: /tap anywhere once to reconnect/i });
  await expect(tapAnywhere).toBeVisible({ timeout: 30_000 });
  const before = attempts;
  await tapAnywhere.click();
  await expect.poll(() => attempts).toBeGreaterThan(before);
});

test("the passphrase can be forgotten on this phone", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("pottery-coach-voice-passphrase", "field-test"));
  await page.reload();
  await page.getByRole("button", { name: /forget passphrase/i }).click();
  await expect(page.getByLabel(/voice passphrase/i)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("pottery-coach-voice-passphrase"))).toBeNull();
});
