import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for plain logic (permissions, policies, route rules, and later
// validation schemas). Browser-level checks of whole pages are done
// separately against a running dev server.
export default defineConfig({
  resolve: {
    // Mirrors tsconfig's "@/*" path, so tests import modules exactly as the
    // app does.
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "generated/**"],
  },
});
