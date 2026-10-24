import { expect, test, type Page } from "@playwright/test";
import { endSession, openSetup, startSession, voiceTool } from "./fixtures/session-streams";

function spokenCues(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__potteryVoice?.spokenCues ?? []);
}

async function confirmGoal(page: Page, centimetres: number) {
  await voiceTool(page, "proposeSetup", { goal: { height: { value: centimetres, unit: "cm" }, basis: "wet" } });
  await voiceTool(page, "confirmSetup");
}

async function loadDemoReading(page: Page) {
  await openSetup(page);
  await page.getByRole("button", { name: /load deterministic demo calibration/i }).click();
  await page.getByRole("button", { name: "Close" }).click();
}

test("the coach speaks a height milestone once, without being asked", async ({ page }) => {
  await startSession(page);
  await confirmGoal(page, 15);
  await loadDemoReading(page);
  await expect.poll(() => spokenCues(page), { timeout: 10_000 }).toContain("You're at 80% of your goal height.");
  await page.waitForTimeout(3_000);
  expect((await spokenCues(page)).filter((line) => line.includes("80%"))).toHaveLength(1);
});

test("next piece saves the pot, waits for an empty wheel, and starts another", async ({ page }) => {
  await startSession(page);
  await expect(voiceTool(page, "nextPiece", { confirmed: false })).resolves.toHaveProperty("needsConfirmation");
  await expect(voiceTool(page, "nextPiece", { confirmed: true })).resolves.toMatchObject({ started: true });
  await openSetup(page);
  await expect(page.getByRole("heading", { name: /settings · piece 2/i })).toBeVisible();
  await expect(page.locator(".history-list > li")).toHaveCount(2);
});

test("lasting notes are remembered, shown, and can be forgotten by touch", async ({ page }) => {
  await startSession(page);
  await voiceTool(page, "rememberNote", { text: "Working on thinner walls", lasting: true });
  await openSetup(page);
  const notes = page.getByRole("region", { name: /what the coach remembers/i });
  await expect(notes).toContainText("Working on thinner walls");
  await notes.getByRole("button", { name: /forget/i }).click();
  await expect(notes).not.toContainText("Working on thinner walls");
});

test("a measured size and the potter's own notes end up in the throw log", async ({ page }) => {
  await startSession(page);
  await loadDemoReading(page);
  await expect(
    voiceTool(page, "reportTrueSize", { dimension: "height", value: 14.5, unit: "cm" }),
  ).resolves.toMatchObject({ recorded: true, trueMm: 145, appMm: 120 });
  await voiceTool(page, "rememberNote", { text: "Throwing a mug today", lasting: false });
  await endSession(page);
  const pieces = page.getByRole("region", { name: /your piece/i });
  await expect(pieces).toContainText("You measured height 14.5 cm; the app read 12.0 cm");
  await expect(pieces).toContainText("Throwing a mug today");
  await pieces.getByLabel(/note for piece 1/i).fill("Base cracked while drying");
  await pieces.getByRole("button", { name: /add note/i }).click();
  await expect(pieces).toContainText("Base cracked while drying");
});

test("About asks for an empty wheel, and the live screen says when it's been seen", async ({ page }) => {
  await page.goto("/?mode=demo");
  await page.getByRole("button", { name: "About" }).click();
  await expect(page.getByText(/start with an empty wheel/i)).toBeVisible();
  await page.getByRole("button", { name: /start session/i }).click();
  await expect(page.getByText(/looking at the empty wheel|got the empty wheel/i).first()).toBeVisible();
});
