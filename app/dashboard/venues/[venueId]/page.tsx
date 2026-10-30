import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArchiveListingButton } from "@/components/dashboard/archive-listing-button";
import { requirePermission } from "@/lib/auth-guards";
import { getVenuePage, type VenueListingRow } from "@/lib/dashboard/listings";

function ArchivedBadge() {
  return (
    <span className="inline-block rounded-full bg-muted px-2.5 py-1 text-xs font-medium whitespace-nowrap text-muted-foreground">
      Archived
    </span>
  );
}

function UpcomingCount({ count }: { count: number }) {
  return (
    <span className="tabular-nums">
      {count} upcoming {count === 1 ? "booking" : "bookings"}
    </span>
  );
}

function ListingActions({ listing }: { listing: VenueListingRow }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/dashboard/listings/${listing.id}`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
        aria-label={`Edit ${listing.name}`}
      >
        Edit
      </Link>
      <Link
        href={`/dashboard/bookings?listing=${listing.id}`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
        aria-label={`Bookings for ${listing.name}`}
      >
        Bookings
      </Link>
      <ArchiveListingButton
        listingId={listing.id}
        listingName={listing.name}
        archived={listing.archived}
        upcomingBookings={listing.upcomingBookings}
      />
    </div>
  );
}

// A venue's page: its settings at a glance (changed through "Edit venue")
// and its listings, which are archived and restored here. Archived listings
// are hidden until "Show archived" is used; that choice lives in the URL
// (?archived=1), so it survives a refresh and the back button.
export default async function VenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ archived?: string }>;
}) {
  await requirePermission("venues:manage");
  const [{ venueId }, { archived }] = await Promise.all([params, searchParams]);
  const showArchived = archived === "1";
  const venue = await getVenuePage(venueId, showArchived);
  // Missing, or someone else's: the same not-found either way, so another
  // owner's venue is never confirmed to exist.
  if (!venue || "ok" in venue) notFound();

  const basePath = `/dashboard/venues/${venue.id}`;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/dashboard/venues" className="mb-4 inline-flex min-h-6 items-center text-sm text-muted-foreground hover:text-foreground">
          ← Venues
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">{venue.name}</h1>
            <p className="text-muted-foreground">
              {venue.address}, {venue.location}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/bookings?venue=${venue.id}`} className={buttonVariants({ variant: "outline" })}>
              Bookings
            </Link>
            <Link href={`${basePath}/edit`} className={buttonVariants({ variant: "outline" })}>
              Edit venue
            </Link>
          </div>
        </div>

        <dl className="mt-4 grid gap-x-8 gap-y-2 rounded-md border bg-card p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Booking window</dt>
            <dd className="font-medium">{venue.bookingWindowDays} days ahead</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Checkout hold</dt>
            <dd className="font-medium">{venue.holdDurationMinutes} minutes</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Timezone</dt>
            <dd className="font-medium">{venue.timezone}</dd>
          </div>
          {venue.ownerName && (
            <div>
              <dt className="text-muted-foreground">Owner</dt>
              <dd className="font-medium">{venue.ownerName}</dd>
            </div>
          )}
        </dl>
        {venue.description && <p className="mt-3 max-w-prose text-sm text-muted-foreground">{venue.description}</p>}
      </div>

      <section aria-labelledby="listings-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="listings-heading" className="text-lg font-semibold">
            Listings
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            {venue.archivedCount > 0 && (
              <Link
                href={showArchived ? basePath : `${basePath}?archived=1`}
                className="text-sm font-medium text-primary underline underline-offset-4"
              >
                {showArchived ? "Hide archived" : `Show archived (${venue.archivedCount})`}
              </Link>
            )}
            <Link href={`${basePath}/listings/new`} className={buttonVariants({ variant: "default", size: "sm" })}>
              Add a listing
            </Link>
          </div>
        </div>

        {venue.listings.length === 0 ? (
          <p className="rounded-md border bg-card p-4 text-muted-foreground">
            {venue.archivedCount > 0 && !showArchived
              ? "All of this venue's listings are archived."
              : "This venue has no listings yet. Add one so people can book it."}
          </p>
        ) : (
          <>
            {/* Desktop: a table. Phones: the same rows as cards, the pattern
                the overview and My Bookings use. */}
            <div className="hidden overflow-x-auto rounded-md border bg-card md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium">Listing</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3 font-medium">Schedule</th>
                    <th className="px-4 py-3 font-medium">Upcoming</th>
                    <th className="px-4 py-3 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {venue.listings.map((listing) => (
                    <tr key={listing.id} className={cn("border-b last:border-0", listing.archived && "bg-muted/30")}>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{listing.name}</span>
                          {listing.archived && <ArchivedBadge />}
                        </div>
                        <p className="text-muted-foreground">{listing.activityName}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{listing.price}</td>
                      <td className="px-4 py-3 text-muted-foreground">{listing.schedule ?? "Not set"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <UpcomingCount count={listing.upcomingBookings} />
                      </td>
                      <td className="px-4 py-3">
                        <ListingActions listing={listing} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="flex flex-col gap-3 md:hidden">
              {venue.listings.map((listing) => (
                <li key={listing.id} className={cn("rounded-md border bg-card p-4 text-sm", listing.archived && "bg-muted/30")}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{listing.name}</p>
                    {listing.archived && <ArchivedBadge />}
                  </div>
                  <p className="text-muted-foreground">
                    {listing.activityName} · {listing.price}
                  </p>
                  {listing.schedule && <p className="mt-1">{listing.schedule}</p>}
                  <p className="mt-1 text-muted-foreground">
                    <UpcomingCount count={listing.upcomingBookings} />
                  </p>
                  <div className="mt-3">
                    <ListingActions listing={listing} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
