import { expect, type Page } from "@playwright/test";

/** The single clean-handed tap: starts the camera (and the voice coach, if available). */
export async function startSession(page: Page, { demo = true }: { demo?: boolean } = {}) {
  await page.goto(demo ? "/?mode=demo" : "/");
  await page.getByRole("button", { name: /start session/i }).click();
  await expect(page.getByText(/camera active.*frames stay/i)).toBeVisible();
}

/** Opens the settings sheet (the touch fallback for setup); it starts closed when voice is available. */
export async function openSetup(page: Page) {
  const settings = page.getByRole("button", { name: "Settings", exact: true });
  if ((await settings.getAttribute("aria-expanded")) !== "true") await settings.click();
  await expect(page.getByRole("region", { name: /session settings/i })).toBeVisible();
}

export async function beginDemoSession(page: Page) {
  await startSession(page);
  await openSetup(page);
  await page.getByRole("button", { name: /load deterministic demo calibration/i }).click();
  await expect(page.locator(".setup-summary")).toContainText(/sizes are in centimetres/i);
}

export async function confirmWetGoal(page: Page) {
  await openSetup(page);
  await page.getByRole("button", { name: /review goal/i }).click();
  await page.getByRole("button", { name: /confirm goal/i }).click();
}

export async function endSession(page: Page) {
  await page.getByRole("button", { name: /^end session$/i }).click();
  await page.getByRole("button", { name: /end session and review/i }).click();
  await expect(page.getByRole("heading", { name: /throw complete/i })).toBeVisible();
}

/** Whether the app still has the scripted voice call open. */
export function voiceConnected(page: Page): Promise<boolean> {
  return page.evaluate(() => window.__potteryVoice?.connected ?? false);
}

/** Plays the voice model's part in demo mode: calls a tool and returns the app's answer. */
export function voiceTool<T = Record<string, unknown>>(
  page: Page,
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  return page.evaluate(([tool, input]) => window.__potteryVoice!.callTool(tool, input), [
    name,
    args,
  ] as const) as Promise<T>;
}
