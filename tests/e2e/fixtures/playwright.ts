import { expect, test as base } from "@playwright/test";

export const test = base.extend({
  page: async ({ page, browserName }, use) => {
    if (browserName === "webkit") {
      await page.addInitScript(() => {
        Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
          configurable: true,
          value: async () => {
            const canvas = document.createElement("canvas");
            canvas.width = 1280;
            canvas.height = 720;
            const context = canvas.getContext("2d");
            context?.fillRect(0, 0, canvas.width, canvas.height);
            return canvas.captureStream(30);
          },
        });
      });
    }
    await use(page);
  },
});

export { expect };
