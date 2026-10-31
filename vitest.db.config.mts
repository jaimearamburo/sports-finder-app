import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests that run the booking code against a real Postgres (*.db.test.ts):
// the row locks, transactions and capacity sums can't be faked. Run with
// `pnpm test:db`. Locally that's the Neon development database from .env;
// CI starts an empty Postgres and applies the migrations first. The tests
// create their own rows and delete them afterwards, and refuse production
// (test/db-setup.ts).
export default defineConfig({
  // The same aliases as vitest.config.mts.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["**/*.db.test.ts"],
    exclude: ["node_modules/**", ".next/**", "generated/**"],
    setupFiles: ["./test/db-setup.ts"],
    // A remote database adds round-trip time to every query.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
