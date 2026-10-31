import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

// End-to-end tests: real browser checks against a dev server and the local
// database.
//
// Run with `pnpm test:e2e`. Starts `pnpm dev` if nothing is listening on the
// base URL, creates its own test records (e2e/fixtures.ts) and removes them
// afterwards.
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  // One worker: tests share one server and database and some check writes, so
  // they run sequentially for deterministic results.
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure" },
  webServer: { command: "pnpm dev", url: `${baseURL}/login`, reuseExistingServer: true, timeout: 180_000 },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"] },
  ],
});
