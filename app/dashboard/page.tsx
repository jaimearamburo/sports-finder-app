import { auth } from "@/auth";

/**
 * Placeholder protected route. Phase 7 ("My Bookings") will eventually
 * live here. Its job for now is to exist as a real route under
 * `/dashboard` that proxy.ts has something concrete to protect.
 */
export default async function DashboardPage() {
  // Safe to assume a session exists here - middleware already redirected
  // anyone without one before this component rendered. Reads the current
  // session to display the signed-in user's email.
  const session = await auth();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="text-muted-foreground">Signed in as {session?.user?.email}</p>
    </div>
  );
}
