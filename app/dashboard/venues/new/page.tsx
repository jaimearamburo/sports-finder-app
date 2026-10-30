import Link from "next/link";
import { VenueForm } from "@/components/dashboard/venue-form";
import { requirePermission } from "@/lib/auth-guards";
import { can } from "@/lib/authz/permissions";
import { getCityOptions, getOwnerOptions } from "@/lib/dashboard/venues";
import { NEW_VENUE_DEFAULTS } from "@/lib/validation/venue";

export default async function NewVenuePage() {
  const session = await requirePermission("venues:create");
  const [cityGroups, ownerOptions] = await Promise.all([
    getCityOptions(),
    // Admins choose the owner; anyone else owns what they add.
    can(session.user, "venues:assign-owner") ? getOwnerOptions() : undefined,
  ]);

  return (
    <div>
      <Link href="/dashboard/venues" className="mb-4 inline-flex min-h-6 items-center text-sm text-muted-foreground hover:text-foreground">
        ← Venues
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Add a venue</h1>
      <VenueForm
        cityGroups={cityGroups}
        ownerOptions={Array.isArray(ownerOptions) ? ownerOptions : undefined}
        initialValues={{ ownerId: "", name: "", description: "", address: "", cityId: "", ...NEW_VENUE_DEFAULTS }}
      />
    </div>
  );
}
