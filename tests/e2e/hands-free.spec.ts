import { expect, test } from "@playwright/test";
import { endSession, openSetup, startSession, voiceConnected, voiceTool } from "./fixtures/session-streams";

test("a whole session runs by voice after the single tap", async ({ page }) => {
  await startSession(page);
  await expect(page.getByRole("region", { name: /conversation/i })).toHaveCount(0);
  await expect.poll(() => voiceConnected(page)).toBe(true);
  await expect(page.getByRole("region", { name: /session settings/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^end session$/i })).toBeVisible();

  await expect(voiceTool(page, "getSetupStatus")).resolves.toMatchObject({
    missing: ["wheel-head diameter", "goal height"],
  });
  const proposal = await voiceTool<{ readback: string }>(page, "proposeSetup", {
    wheelHeadDiameter: { value: 14, unit: "in" },
    goal: { height: { value: 15, unit: "cm" }, basis: "wet" },
  });
  expect(proposal.readback).toContain("15 centimetres (that's 1-5)");
  await voiceTool(page, "confirmSetup");
  await openSetup(page);
  await expect(page.locator(".setup-summary")).toContainText(/goal 15 cm wet/i);

  await expect(voiceTool(page, "getCurrentDimensions")).resolves.not.toHaveProperty("heightMm");
  await expect(voiceTool(page, "markMoment", { label: "first pull" })).resolves.toHaveProperty("id");

  await expect(voiceTool(page, "endSession", { confirmed: false })).resolves.toHaveProperty("needsConfirmation");
  await expect(page.getByText(/camera active/i)).toBeVisible();
  await expect(voiceTool(page, "endSession", { confirmed: true })).resolves.toMatchObject({
    ended: true,
    summary: { markedMoments: 1 },
  });
  await expect(page.getByRole("heading", { name: /throw complete/i })).toBeVisible();
  expect(await voiceConnected(page)).toBe(true);
  await page.evaluate(() => window.__potteryVoice!.say("assistant", "Nice pull. See you next time."));
  await expect.poll(() => voiceConnected(page)).toBe(false);
});

test("ending by touch hangs up the coach straight away", async ({ page }) => {
  await startSession(page);
  await endSession(page);
  await expect.poll(() => voiceConnected(page)).toBe(false);
});

test("'same as last time' brings back the previous setup for one confirmation", async ({ page }) => {
  await startSession(page);
  await voiceTool(page, "proposeSetup", {
    wheelHeadDiameter: { value: 13, unit: "in" },
    targetId: "tapered-cylinder-v1",
  });
  await voiceTool(page, "confirmSetup");
  await page.goto("/?mode=demo");
  await page.getByRole("button", { name: /start session/i }).click();
  const loaded = await voiceTool<{ readback: string }>(page, "loadLastSetup");
  expect(loaded.readback).toMatch(/13 inches.*tapered cylinder/);
});

test("captions stay off the camera until enabled in Settings", async ({ page }) => {
  await startSession(page);
  await page.evaluate(() => window.__potteryVoice!.say("assistant", "What are we making today?"));
  await expect(page.getByRole("region", { name: /conversation/i })).toHaveCount(0);
  await openSetup(page);
  await page.getByRole("checkbox", { name: /show captions/i }).check();
  await expect(page.getByRole("region", { name: /conversation/i })).toContainText("What are we making today?");
});

test("the coach hangs up after an hour, and reconnect carries on", async ({ page }) => {
  await page.clock.install();
  await startSession(page);
  await page.clock.fastForward(60 * 60_000);
  const reconnect = page.getByRole("button", { name: /reconnect voice/i });
  await expect(reconnect).toBeVisible();
  expect(await voiceConnected(page)).toBe(false);
  await reconnect.click();
  await expect.poll(() => voiceConnected(page)).toBe(true);
  await expect(reconnect).toHaveCount(0);
});
