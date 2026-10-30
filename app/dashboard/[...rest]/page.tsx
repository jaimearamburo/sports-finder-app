import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth-guards";

// Catches any dashboard address with no page of its own (a mistyped or old
// link), so it shows the dashboard's not-found inside the dashboard nav
// rather than the site-wide 404. Real pages always take precedence over
// this catch-all. Still checks permission first, like every dashboard page.
export default async function DashboardCatchAll() {
  await requirePermission("dashboard:access");
  notFound();
}
