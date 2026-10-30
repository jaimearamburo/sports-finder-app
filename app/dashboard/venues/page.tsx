import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth-guards";
import { can } from "@/lib/authz/permissions";
import { listManagedVenues } from "@/lib/dashboard/venues";

// Every venue this user manages: their own as an owner, all of them (with
// owners) as an admin.
export default async function DashboardVenuesPage() {
  const session = await requirePermission("dashboard:access");
  const venues = await listManagedVenues();
  // Only an auth failure isn't a list, and requirePermission ruled it out.
  if (!Array.isArray(venues)) notFound();
  const canCreate = can(session.user, "venues:create");

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Venues</h1>
        {canCreate && (
          <Link href="/dashboard/venues/new" className={buttonVariants({ variant: "default" })}>
            Add a venue
          </Link>
        )}
      </div>

      {venues.length === 0 ? (
        <p className="rounded-md border bg-card p-4 text-muted-foreground">
          You don&apos;t have any venues yet. Add one to start taking bookings.
        </p>
      ) : (
        <ul className="divide-y rounded-md border bg-card">
          {venues.map((venue) => (
            <li key={venue.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">{venue.name}</p>
                <p className="text-sm text-muted-foreground">
                  {venue.location}
                  {venue.ownerName && <> · Owner: {venue.ownerName}</>}
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground tabular-nums">
                  {venue.activeListings} {venue.activeListings === 1 ? "listing" : "listings"}
                </span>
                <Link
                  href={`/dashboard/venues/${venue.id}/edit`}
                  className="font-medium text-primary underline underline-offset-4"
                  aria-label={`Edit ${venue.name}`}
                >
                  Edit
                </Link>
                <Link
                  href={`/dashboard/venues/${venue.id}`}
                  className="font-medium text-primary underline underline-offset-4"
                  aria-label={`Manage ${venue.name}`}
                >
                  Manage
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
