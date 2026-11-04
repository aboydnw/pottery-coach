import { expect, test } from "@playwright/test";

import { openSetup, startSession } from "./fixtures/session-streams";

test("keeps training-data controls out of ordinary sessions", async ({ page }) => {
  await startSession(page);
  await openSetup(page);
  await expect(page.getByRole("region", { name: "Clay model training data" })).toHaveCount(0);
});

test("captures and reviews an exact processed frame in explicit dataset mode", async ({ page }) => {
  await page.goto("/?mode=demo&dataset=1");
  await page.getByRole("button", { name: /start session/i }).click();
  await expect(page.getByText(/camera active.*frames stay/i)).toBeVisible();
  await openSetup(page);

  const workspace = page.getByRole("region", { name: "Clay model training data" });
  await expect(workspace).toBeVisible();
  const capture = workspace.getByRole("button", { name: "Capture training example" });
  await expect(capture).toBeEnabled({ timeout: 20_000 });
  await capture.click();
  await expect(workspace.getByRole("heading", { name: "Review the clay outline" })).toBeVisible();
  await workspace.getByLabel("Hands in frame").check();
  await workspace.getByRole("button", { name: "Outline is correct" }).click();
  await expect(workspace).toContainText("1 reviewed example stored on this device");
});
