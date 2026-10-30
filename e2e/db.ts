import pg from "pg";

// Direct database access for the end-to-end tests: creating their test
// records and checking what a request did or didn't change. Plain `pg`
// rather than the app's Prisma client - Prisma 7's generated client is an
// ES module, and Playwright loads this project's TypeScript as CommonJS, so
// the two can't share a process. These are small, fixed queries, so SQL is
// clear enough.
//
// Uses the direct (non-pooled) connection, like the Prisma CLI. Supabase's
// certificate chain isn't in Node's trust store, hence rejectUnauthorized:
// false - acceptable for a local test run against a development database.

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (pool) return pool;
  const raw = process.env.POSTGRES_URL_NON_POOLING;
  if (!raw) throw new Error("POSTGRES_URL_NON_POOLING is not set (the e2e tests read .env).");
  const url = new URL(raw);
  url.searchParams.delete("sslmode");
  pool = new pg.Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: false }, max: 2 });
  return pool;
}

export async function query<T extends pg.QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await getPool().query<T>(sql, params)).rows;
}

export async function closeDb() {
  await pool?.end();
  pool = null;
}

// Timestamps in this schema are `timestamp without time zone` holding UTC
// (Prisma's convention), so they're written as UTC wall-clock text.
export function utc(date: Date): string {
  return date.toISOString().replace("T", " ").replace("Z", "");
}
