import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for plain logic: no database, no network, no secrets, so CI can
// run them anywhere. Tests that need a real database are *.db.test.ts and
// run separately (vitest.db.config.mts); browser-level checks of whole
// pages are the Playwright tests in e2e/.
export default defineConfig({
  resolve: {
    // Mirrors tsconfig's "@/*" path, so tests import modules exactly as the
    // app does.
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
