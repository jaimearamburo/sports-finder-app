import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

// End-to-end tests (e2e/): real browser checks of whole pages against a
// running dev server and the local database. Unit tests of plain logic
// live next to their files and run with Vitest (`pnpm test`).
//
// Run with `pnpm test:e2e`. It starts `pnpm dev` if nothing is already
// listening on the base URL, creates its own test accounts and records
// (e2e/fixtures.ts), and removes them afterwards.
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  // One worker: the tests share one dev server and database, and some
  // check what a write did, so running them one at a time keeps results
  // deterministic.
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
