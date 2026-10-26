import { auth } from "@/auth";

/**
 * Placeholder for the new account area - the side nav plus a "My
 * Bookings" section (and later, role-based sections like "My Venues" for
 * venue owners) is its own later ticket. For now this exists so the
 * header's "My Account" link (regular users only - see
 * lib/account-nav.ts) has somewhere real to go.
 */
export default async function AccountPage() {
  // Safe to assume a session exists here - proxy.ts already redirected
  // anyone without one before this component rendered.
  const session = await auth();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4">
      <h1 className="text-xl font-semibold">My Account</h1>
      <p className="text-muted-foreground">Signed in as {session?.user?.email}</p>
    </div>
  );
}
