import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations need the direct connection: transaction-mode pooling doesn't
    // support the session features they use.
    url: env("POSTGRES_URL_NON_POOLING"),
  },
});