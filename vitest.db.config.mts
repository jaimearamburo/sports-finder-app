import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests that run the booking code against a real Postgres (*.db.test.ts), since
// row locks, transactions and capacity sums can't be faked. `pnpm test:db`:
// locally the Neon dev database from .env; in CI an empty Postgres with
// migrations applied. Tests create and delete their own rows and refuse
// production (test/db-setup.ts).
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
