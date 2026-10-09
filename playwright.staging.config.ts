import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.STAGING_URL;
if (!baseURL) throw new Error("STAGING_URL is required for staging verification");

export default defineConfig({ testDir: "./tests/e2e", use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "staging-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "staging-mobile-safari", use: { ...devices["iPhone 15"] } }] });
