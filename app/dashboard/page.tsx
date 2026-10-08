import { auth } from "@/auth";

/**
 * Placeholder protected route (ticket #71).
 *
 * This page has no feature purpose yet — Phase 7 ("My Bookings") will
 * eventually live here or somewhere similar. Its job right now is just to
 * exist as a real route under `/dashboard` so proxy.ts 
 * has something concrete to protect and we can complete the test
 */
export default async function DashboardPage() {
  // Safe to assume a session exists here — middleware already redirected
  // anyone without one before this component ever rendered.
  const session = await auth();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="text-muted-foreground">Signed in as {session?.user?.email}</p>
    </div>
  );
}
