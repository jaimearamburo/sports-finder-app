import pg from "pg";

// Direct database access for the e2e tests: creating test records and checking
// what requests changed. Plain `pg`, because Prisma 7's client is an ES module
// and Playwright loads this project's TypeScript as CommonJS.
//
// Uses the direct connection, like the Prisma CLI. rejectUnauthorized: false
// because some hosts' certificate chains aren't in Node's trust store;
// acceptable for a development database (production is refused in
// global-setup.ts).

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

// Columns are `timestamp without time zone` holding UTC, so values are written
// as UTC text.
export function utc(date: Date): string {
  return date.toISOString().replace("T", " ").replace("Z", "");
}
