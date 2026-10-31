import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests: no database, network or secrets, so CI runs them anywhere.
// *.db.test.ts runs separately (vitest.db.config.mts); browser tests are in
// e2e/.
export default defineConfig({
  resolve: {
    // Mirrors tsconfig's "@/*" path.
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "generated/**", "**/*.db.test.ts"],
  },
});
