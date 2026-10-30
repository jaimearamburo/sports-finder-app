import Link from "next/link";
import { notFound } from "next/navigation";
import { VenueForm } from "@/components/dashboard/venue-form";
import { requirePermission } from "@/lib/auth-guards";
import { can } from "@/lib/authz/permissions";
import { getCityOptions, getOwnerOptions, getVenueForEdit } from "@/lib/dashboard/venues";

export default async function EditVenuePage({ params }: { params: Promise<{ venueId: string }> }) {
  const session = await requirePermission("venues:manage");
  const { venueId } = await params;
  const [venue, cityGroups, ownerOptions] = await Promise.all([
    getVenueForEdit(venueId),
    getCityOptions(),
    // Admins can move a venue to a different owner.
    can(session.user, "venues:assign-owner") ? getOwnerOptions() : undefined,
  ]);
  // Missing, or someone else's: the same not-found either way, so another
  // owner's venue is never confirmed to exist.
  if (!venue || "ok" in venue) notFound();

  const { id, ...values } = venue;
  // If the current owner isn't someone who can own venues (e.g. a venue
  // made before owners had to be chosen), start the Owner field empty so
  // the admin is asked to pick one, rather than showing an unlisted id.
  const owners = Array.isArray(ownerOptions) ? ownerOptions : undefined;
  const ownerListed = owners?.some((owner) => owner.id === values.ownerId) ?? true;
  const initialValues = ownerListed ? values : { ...values, ownerId: "" };
  return (
    <div>
      <Link href="/dashboard/venues" className="mb-4 inline-flex min-h-6 items-center text-sm text-muted-foreground hover:text-foreground">
        ← Venues
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Edit {venue.name}</h1>
      <VenueForm
        venueId={id}
        initialValues={initialValues}
        cityGroups={cityGroups}
        ownerOptions={owners}
      />
    </div>
  );
}
