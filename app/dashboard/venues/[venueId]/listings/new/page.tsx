import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingForm } from "@/components/dashboard/listing-form";
import { requirePermission } from "@/lib/auth-guards";
import { getActivityOptions, getNewListingVenue } from "@/lib/dashboard/listings";
import { NEW_LISTING_DEFAULTS } from "@/lib/validation/listing";

export default async function NewListingPage({ params }: { params: Promise<{ venueId: string }> }) {
  await requirePermission("venues:manage");
  const { venueId } = await params;
  const [venue, activities] = await Promise.all([getNewListingVenue(venueId), getActivityOptions()]);
  // Missing, or someone else's venue: the same not-found either way.
  if (!venue || "ok" in venue) notFound();

  return (
    <div>
      <Link
        href={`/dashboard/venues/${venue.id}`}
        className="mb-4 inline-flex min-h-6 items-center text-sm text-muted-foreground hover:text-foreground"
      >
        ← {venue.name}
      </Link>
      <h1 className="text-2xl font-bold">Add a listing</h1>
      <p className="mb-6 text-muted-foreground">
        At {venue.name}, {venue.cityName}
      </p>
      <ListingForm
        venue={venue}
        activities={activities}
        initialValues={{ activityId: "", name: "", description: "", imageUrl: null, price: Number.NaN, ...NEW_LISTING_DEFAULTS }}
      />
    </div>
  );
}
