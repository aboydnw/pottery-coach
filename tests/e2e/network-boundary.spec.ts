import { expect, test } from "@playwright/test";
import { startSession } from "./fixtures/session-streams";

test("camera workflow sends no raw image, video, or frame payload", async ({ page }) => {
  const violations: string[] = [];
  page.on("request", (request) => {
    const type = request.resourceType();
    const body = request.postData() ?? "";
    if (["image", "media"].includes(type) && request.method() !== "GET") violations.push(`${type}:${request.url()}`);
    if (body.length > 100_000 || /data:(image|video)\//i.test(body)) violations.push(`payload:${request.url()}`);
    if (!new URL(request.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/))
      violations.push(`domain:${request.url()}`);
  });
  await startSession(page, { demo: false });
  await page.waitForTimeout(1_500);
  expect(violations).toEqual([]);
});
