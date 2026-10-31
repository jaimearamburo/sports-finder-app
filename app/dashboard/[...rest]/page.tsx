import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth-guards";

// Unknown dashboard URLs show the dashboard's not-found inside its nav, not the
// site-wide 404. Real pages take precedence. Checks permission first like every
// dashboard page.
export default async function DashboardCatchAll() {
  await requirePermission("dashboard:access");
  notFound();
}
