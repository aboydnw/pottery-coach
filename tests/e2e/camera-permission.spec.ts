import { expect, test } from "@playwright/test";

test("camera starts only after consent and can be stopped", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /begin private setup/i }).click();

  await expect(page.getByRole("button", { name: "Start camera" })).toBeVisible();
  await expect(page.getByText(/Camera delivering/)).toHaveCount(0);

  await page.getByRole("button", { name: "Start camera" }).click();

  await expect(page.getByText(/Camera delivering/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Stop camera" })).toBeVisible();

  await page.getByRole("button", { name: "Stop camera" }).click();

  await expect(page.getByText(/Camera delivering/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start camera" })).toBeVisible();
});
