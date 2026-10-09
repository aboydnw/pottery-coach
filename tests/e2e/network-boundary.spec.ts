import { expect, test } from "@playwright/test";

test("camera workflow sends no raw image, video, or frame payload", async ({ page }) => {
  const violations: string[] = [];
  page.on("request", (request) => {
    const type = request.resourceType();
    const body = request.postData() ?? "";
    if (["image", "media"].includes(type) && request.method() !== "GET") violations.push(`${type}:${request.url()}`);
    if (body.length > 100_000 || /data:(image|video)\//i.test(body)) violations.push(`payload:${request.url()}`);
    if (!new URL(request.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/)) violations.push(`domain:${request.url()}`);
  });
  await page.goto("/");
  await page.getByRole("button", { name: /begin private setup/i }).click();
  await page.getByRole("button", { name: "Start camera" }).click();
  await expect(page.getByRole("button", { name: "Stop camera" })).toBeVisible();
  expect(violations).toEqual([]);
});
