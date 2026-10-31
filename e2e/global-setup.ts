import type { FullConfig } from "@playwright/test";
import { createTestData } from "./fixtures";
import { closeDb } from "./db";

// Runs once before all tests: creates the test accounts and records, and
// hands the run's password and record ids to the test workers through
// environment variables (which Playwright passes on to them).
//
// It writes to whatever database .env points at, so it only runs against a
// local server and refuses the production database: the safety catches
// against a run ever touching live data.
export default async function globalSetup(config: FullConfig) {
  const baseURL = String(config.projects[0]?.use.baseURL ?? "");
  const host = new URL(baseURL).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(`End-to-end tests only run against a local server (got ${baseURL}).`);
  }
  // The same catch for the database: production is the Supabase one, local
  // development and tests use their own (see "Databases" in CLAUDE.md).
  const dbHost = new URL(process.env.POSTGRES_URL_NON_POOLING ?? "postgresql://unset").hostname;
  if (dbHost.endsWith("supabase.com")) {
    throw new Error(`End-to-end tests never run against the production database (got ${dbHost}).`);
  }
  const { password, ids } = await createTestData();
  await closeDb();
  process.env.E2E_PASSWORD = password;
  process.env.E2E_FIXTURES = JSON.stringify(ids);
}
