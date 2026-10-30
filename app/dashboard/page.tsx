import { requirePermission } from "@/lib/auth-guards";

/**
 * Placeholder for the venue manager dashboard, replaced by the overview
 * page in the next slice. Already guarded like every dashboard page will
 * be: requirePermission() is the first line, so a signed-in user without
 * dashboard access gets the not-found page even if they get past the
 * proxy's redirect.
 */
export default async function DashboardPage() {
  const session = await requirePermission("dashboard:access");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="text-muted-foreground">Signed in as {session.user.email}</p>
    </div>
  );
}
