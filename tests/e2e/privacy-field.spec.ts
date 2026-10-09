import { expect, test } from "./fixtures/playwright";

test("raw media is absent from local databases and capture ends explicitly", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: /begin private setup/i }).click();
  await page.getByRole("button", { name: /start camera/i }).click();
  await page.getByRole("button", { name: /stop camera/i }).click();
  await expect(page.getByText(/camera active.*frames stay/i)).toHaveCount(0);
  const serialized = await page.evaluate(async () => {
    const databases = await indexedDB.databases();
    return JSON.stringify(databases);
  });
  expect(serialized).not.toMatch(/raw(Video|Audio)|mediaStream/i);
});
