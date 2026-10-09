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
            let frame = 0;
            const paint = () => {
              if (!context) return;
              context.fillStyle = frame++ % 2 === 0 ? "#111" : "#121212";
              context.fillRect(0, 0, canvas.width, canvas.height);
              requestAnimationFrame(paint);
            };
            paint();
            const testWindow = window as typeof window & { __potteryTestCameras?: HTMLCanvasElement[] };
            testWindow.__potteryTestCameras ??= [];
            testWindow.__potteryTestCameras.push(canvas);
            return canvas.captureStream(30);
          },
        });
      });
    }
    await use(page);
  },
});

export { expect };
