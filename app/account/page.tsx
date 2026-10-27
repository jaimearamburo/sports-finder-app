import { getUserBookingOrders } from "@/lib/bookings";
import { BookingsTable } from "@/components/account/bookings-table";

// The account area's one real section for now (see app/account/layout.tsx
// and lib/account-nav.ts) - every order the signed-in user has ever made,
// most actionable (soonest upcoming) first. getUserBookingOrders is
// withAuth-wrapped, so its failure shape (no session) is only ever
// theoretical here - proxy.ts already redirected anyone without one
// before this page could render - but the array check still has to exist
// to satisfy that function's own return type.
export default async function AccountPage() {
  const result = await getUserBookingOrders();
  const orders = Array.isArray(result) ? result : [];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">My Bookings</h1>
      {orders.length === 0 ? (
        <p className="text-muted-foreground">You haven&apos;t made any bookings yet.</p>
      ) : (
        <BookingsTable orders={orders} />
      )}
    </div>
  );
}
