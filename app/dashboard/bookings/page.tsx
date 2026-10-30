import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BookingsView } from "@/components/dashboard/bookings-view";
import { ManagerBookingsTable } from "@/components/dashboard/manager-bookings-table";
import { requirePermission } from "@/lib/auth-guards";
import { listManagerBookings } from "@/lib/dashboard/bookings";
import { BOOKINGS_PAGE_SIZE, bookingFiltersQuery, parseBookingFilters } from "@/lib/validation/manager-bookings";

// Every booking at the venues this user manages (all venues for an admin),
// filtered and paged. The filters are in the URL - see BookingsView - so a
// listing's "Bookings" link can open this page already filtered to it.
export default async function DashboardBookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("dashboard:access");
  const result = await listManagerBookings(parseBookingFilters(await searchParams));
  // Only an auth failure has no orders, and requirePermission ruled it out.
  if (!("orders" in result)) notFound();
  const { orders, total, page, pageCount, filters, venues } = result;

  const firstShown = (page - 1) * BOOKINGS_PAGE_SIZE + 1;
  const lastShown = firstShown + orders.length - 1;
  const pageHref = (n: number) => {
    const query = bookingFiltersQuery(filters, { page: n });
    return query ? `/dashboard/bookings?${query}` : "/dashboard/bookings";
  };
  const filtered = Boolean(filters.venue || filters.listing || filters.from || filters.to || filters.q);
  const emptyMessage = filtered
    ? "No bookings match these filters."
    : filters.when === "upcoming"
      ? "No upcoming bookings."
      : filters.when === "past"
        ? "No past bookings."
        : "No bookings yet.";

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Bookings</h1>
      <BookingsView filters={filters} venues={venues}>
        {orders.length === 0 ? (
          <p className="rounded-md border bg-card p-6 text-center text-muted-foreground">{emptyMessage}</p>
        ) : (
          <>
            <ManagerBookingsTable orders={orders} />
            {/* "Showing 21–40 of 57", with Previous / Next as plain links,
                so paging keeps every filter and works without JavaScript. */}
            <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
              <p className="text-muted-foreground tabular-nums">
                Showing {firstShown}–{lastShown} of {total} {total === 1 ? "booking" : "bookings"}
              </p>
              {pageCount > 1 && (
                <div className="flex gap-2">
                  <PageLink href={page > 1 ? pageHref(page - 1) : null} label="Previous" />
                  <PageLink href={page < pageCount ? pageHref(page + 1) : null} label="Next" />
                </div>
              )}
            </nav>
          </>
        )}
      </BookingsView>
    </div>
  );
}

// A disabled-looking span at either end, rather than a link to nowhere.
function PageLink({ href, label }: { href: string | null; label: string }) {
  const className = buttonVariants({ variant: "outline", size: "sm" });
  return href ? (
    <Link href={href} className={className}>
      {label}
    </Link>
  ) : (
    <span aria-disabled className={cn(className, "pointer-events-none opacity-50")}>
      {label}
    </span>
  );
}
