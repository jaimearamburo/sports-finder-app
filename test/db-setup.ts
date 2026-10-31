import "dotenv/config";

// Runs before every database test file (vitest.db.config.mts). These tests
// create and delete their own rows in whatever database the environment
// points at, so they refuse production - the Supabase one; development uses
// Neon and CI a throwaway Postgres (see "Databases" in CLAUDE.md).
const url = process.env.POSTGRES_PRISMA_URL;
if (!url) throw new Error("POSTGRES_PRISMA_URL is not set - the database tests need a development or CI database.");
const host = new URL(url).hostname;
if (host.endsWith("supabase.com")) {
  throw new Error(`Database tests never run against the production database (got ${host}).`);
}
