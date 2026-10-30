import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingForm } from "@/components/dashboard/listing-form";
import { requirePermission } from "@/lib/auth-guards";
import { getListingEditor } from "@/lib/dashboard/listings";

export default async function EditListingPage({ params }: { params: Promise<{ listingId: string }> }) {
  await requirePermission("venues:manage");
  const { listingId } = await params;
  const editor = await getListingEditor(listingId);
  // Missing, or someone else's listing: the same not-found either way.
  if (!editor || "ok" in editor || !editor.listing) notFound();
  const { venue, listing } = editor;

  return (
    <div>
      <Link
        href={`/dashboard/venues/${venue.id}`}
        className="mb-4 inline-flex min-h-6 items-center text-sm text-muted-foreground hover:text-foreground"
      >
        ← {venue.name}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{listing.values.name}</h1>
        {listing.archived && (
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">Archived</span>
        )}
      </div>
      <p className="mb-6 text-muted-foreground">
        At {venue.name}, {venue.cityName}
        {listing.archived && " · Hidden from browse until it's restored on the venue page."}
      </p>
      <ListingForm venue={venue} activities={[listing.activity]} initialValues={listing.values} listingId={listing.id} />
    </div>
  );
}
