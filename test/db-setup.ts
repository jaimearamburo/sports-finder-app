import "dotenv/config";

// Runs before every database test file. The tests write to whatever database
// the environment points at, so production (Supabase) is refused.
const url = process.env.POSTGRES_PRISMA_URL;
if (!url) throw new Error("POSTGRES_PRISMA_URL is not set - the database tests need a development or CI database.");
const host = new URL(url).hostname;
if (host.endsWith("supabase.com")) {
  throw new Error(`Database tests never run against the production database (got ${host}).`);
}
