import { getUserBookingOrders } from "@/lib/bookings";
import { BookingsTable } from "@/components/account/bookings-table";

// My Bookings: every order the signed-in user has made, soonest upcoming first.
// getUserBookingOrders' no-session result can't happen here (proxy.ts redirects
// first), but its type still requires the array check.
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
