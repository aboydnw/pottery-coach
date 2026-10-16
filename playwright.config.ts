import { defineConfig, devices } from "@playwright/test";
import { BOARD_VIDEO_PATH, WHEEL_VIDEO_PATH } from "./tests/e2e/support/boardVideo";

const fakeCamera = ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"];
// E2E_PREVIEW=1 runs the suite against a production build (served by `vite preview`) with demo
// shortcuts compiled in, which catches bundling differences such as how workers are emitted.
const preview = process.env.E2E_PREVIEW === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/support/globalSetup.ts",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: preview
      ? "VITE_ENABLE_DEMO=true pnpm exec vite build && pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort"
      : "VITE_CLOUD_VOICE=true pnpm dev --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /(calibration-board|wheel-head)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], permissions: ["camera", "microphone"], launchOptions: { args: fakeCamera } },
    },
    {
      name: "mobile-chromium",
      testIgnore: /(calibration-board|wheel-head)\.spec\.ts/,
      use: { ...devices["Pixel 7"], permissions: ["camera", "microphone"], launchOptions: { args: fakeCamera } },
    },
    {
      name: "chromium-board-camera",
      testMatch: /calibration-board\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        permissions: ["camera", "microphone"],
        launchOptions: { args: [...fakeCamera, `--use-file-for-fake-video-capture=${BOARD_VIDEO_PATH}`] },
      },
    },
    {
      name: "chromium-wheel-camera",
      testMatch: /wheel-head\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        permissions: ["camera", "microphone"],
        launchOptions: { args: [...fakeCamera, `--use-file-for-fake-video-capture=${WHEEL_VIDEO_PATH}`] },
      },
    },
    {
      name: "mobile-webkit",
      testMatch: /accessibility\.spec\.ts/,
      use: { ...devices["iPhone 15"] },
    },
  ],
});
