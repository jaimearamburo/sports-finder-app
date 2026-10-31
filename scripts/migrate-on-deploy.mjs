// Runs before `next build` (package.json "build").
//
// Applies pending migrations (`prisma migrate deploy`: only committed
// migrations; never generates or resets) on Vercel production builds only.
// Preview builds of `dev` and local builds skip it, so an unmerged migration
// can't touch production. A failed migration fails the deploy, leaving the old
// version live.
import { execSync } from "node:child_process";

if (process.env.VERCEL_ENV === "production") {
  console.log("Production deploy: applying pending database migrations.");
  execSync("prisma migrate deploy", { stdio: "inherit" });
} else {
  console.log(`Skipping database migrations (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}).`);
}
