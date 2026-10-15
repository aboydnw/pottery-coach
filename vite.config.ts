import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      manifest: false,
      workbox: {
        // Only app routes fall back to index.html offline. Without this, opening the printable board
        // (or any other static file) in a new tab showed the app's first screen instead of the file.
        navigateFallbackAllowlist: [/^\/$/, /^\/session(\/|$)/],
      },
    }),
  ],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["{src,worker,benchmarks,research}/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
        },
      },
    ],
  },
});
