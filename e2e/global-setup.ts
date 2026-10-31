import type { FullConfig } from "@playwright/test";
import { createTestData } from "./fixtures";
import { closeDb } from "./db";

// Runs once before all tests: creates the test records and passes the run's
// password and ids to workers through env vars.
//
// It writes to the database in .env, so it refuses non-local servers and the
// production database.
export default async function globalSetup(config: FullConfig) {
  const baseURL = String(config.projects[0]?.use.baseURL ?? "");
  const host = new URL(baseURL).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(`End-to-end tests only run against a local server (got ${baseURL}).`);
  }
  // Production is the Supabase database; development and tests use Neon.
  const dbHost = new URL(process.env.POSTGRES_URL_NON_POOLING ?? "postgresql://unset").hostname;
  if (dbHost.endsWith("supabase.com")) {
    throw new Error(`End-to-end tests never run against the production database (got ${dbHost}).`);
  }
  const { password, ids } = await createTestData();
  await closeDb();
  process.env.E2E_PASSWORD = password;
  process.env.E2E_FIXTURES = JSON.stringify(ids);
}
