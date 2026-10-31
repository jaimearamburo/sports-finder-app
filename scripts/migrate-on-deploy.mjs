// Runs before `next build` (see the "build" script in package.json).
//
// Local development and production use separate databases, so migrations
// no longer reach production just by running them locally. This applies any
// pending ones (`prisma migrate deploy`: only migrations already in the
// repo, never generates new ones or resets data) on Vercel production
// builds only - not on preview builds of `dev`, so an unmerged migration
// can't touch the production database, and not on local builds.
// A failed migration fails the deploy, so the old version stays live.
import { execSync } from "node:child_process";

if (process.env.VERCEL_ENV === "production") {
  console.log("Production deploy: applying pending database migrations.");
  execSync("prisma migrate deploy", { stdio: "inherit" });
} else {
  console.log(`Skipping database migrations (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}).`);
}
