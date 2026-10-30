import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { requirePermission } from "@/lib/auth-guards";
import { getDashboardOverview, type OverviewBooking } from "@/lib/dashboard/overview";

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

// Same pill shape as My Bookings' status badge. "Payment processing" is
// neutral grey, not amber: yellow is reserved for hold warnings (see the
// design conventions in CLAUDE.md), and this is information, not a problem.
function StatusBadge({ status }: { status: OverviewBooking["status"] }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        status === "confirmed" ? "bg-emerald-600/10 text-emerald-800" : "bg-muted text-muted-foreground"
      )}
    >
      {status === "confirmed" ? "Confirmed" : "Payment processing"}
    </span>
  );
}

// The dashboard's home: headline numbers, the venues this user manages,
// and the next few bookings. An admin sees all of it across every venue.
export default async function DashboardOverviewPage() {
  await requirePermission("dashboard:access");
  const overview = await getDashboardOverview();
  // Only an auth failure has no stats, and requirePermission already ruled
  // that out - this keeps the type honest rather than being a real path.
  if (!("stats" in overview)) notFound();

  const { stats, venues, comingUp, showOwners } = overview;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">Overview</h1>

      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Bookings today" value={String(stats.bookingsToday)} hint="In each venue's local time" />
        <StatCard label="Next 7 days" value={String(stats.bookingsNext7Days)} hint="Including today" />
        <StatCard
          label="Revenue, last 30 days"
          value={formatMoney(stats.revenueLast30Days)}
          hint="Confirmed payments"
        />
      </section>

      <section aria-labelledby="venues-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="venues-heading" className="text-lg font-semibold">
            {showOwners ? "All venues" : "Your venues"}
          </h2>
          <Link href="/dashboard/venues/new" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Add a venue
          </Link>
        </div>
        {venues.length === 0 ? (
          <p className="rounded-md border bg-card p-4 text-muted-foreground">
            You don&apos;t have any venues yet. Add one to start taking bookings.
          </p>
        ) : (
          <ul className="divide-y rounded-md border bg-card">
            {venues.map((venue) => (
              <li key={venue.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/venues/${venue.id}`}
                    className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                  >
                    {venue.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {venue.location}
                    {venue.ownerName && <> · Owner: {venue.ownerName}</>}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {venue.activeListings} {venue.activeListings === 1 ? "listing" : "listings"} ·{" "}
                  {venue.upcomingBookings} upcoming {venue.upcomingBookings === 1 ? "booking" : "bookings"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="coming-up-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="coming-up-heading" className="text-lg font-semibold">
            Coming up
          </h2>
          <Link href="/dashboard/bookings" className="text-sm font-medium text-primary underline underline-offset-4">
            All bookings
          </Link>
        </div>
        {comingUp.length === 0 ? (
          <p className="rounded-md border bg-card p-4 text-muted-foreground">No upcoming bookings.</p>
        ) : (
          <>
            {/* Desktop: a table. Phones: the same rows as cards, the
                pattern My Bookings uses. */}
            <div className="hidden overflow-x-auto rounded-md border bg-card md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium">When (venue time)</th>
                    <th className="px-4 py-3 font-medium">Listing</th>
                    <th className="px-4 py-3 font-medium">Attendee</th>
                    <th className="px-4 py-3 font-medium">Qty</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {comingUp.map((booking) => (
                    <tr key={booking.id} className="border-b last:border-0">
                      <td className="px-4 py-3">{booking.when}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{booking.listingName}</p>
                        <p className="text-muted-foreground">{booking.venueName}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p>{booking.attendeeName}</p>
                        <p className="font-mono text-xs text-muted-foreground">{booking.reference}</p>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{booking.quantity}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={booking.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="flex flex-col gap-3 md:hidden">
              {comingUp.map((booking) => (
                <li key={booking.id} className="rounded-md border bg-card p-4 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{booking.listingName}</p>
                    <StatusBadge status={booking.status} />
                  </div>
                  <p className="text-muted-foreground">{booking.venueName}</p>
                  <p className="mt-2">{booking.when}</p>
                  <p className="mt-1 text-muted-foreground">
                    {booking.attendeeName}
                    {booking.quantity > 1 && <> · × {booking.quantity}</>} ·{" "}
                    <span className="font-mono">{booking.reference}</span>
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
