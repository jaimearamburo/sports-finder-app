import "server-only";
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/auth-guards";
import { can } from "@/lib/authz/permissions";
import { canManageVenue, manageableVenuesWhere, type Actor } from "@/lib/authz/policies";
import { venueSchema, type VenueInput } from "@/lib/validation/venue";
import { getFieldErrors } from "@/lib/validation/field-errors";

export type CityOption = { id: string; label: string; timezone: string };
export type CityOptionGroup = { countryName: string; cities: CityOption[] };

export type ManagedVenue = {
  id: string;
  name: string;
  location: string;
  // Only filled in for admins, who see every owner's venues.
  ownerName: string | null;
  activeListings: number;
};

export type OwnerOption = { id: string; label: string };

export type VenueFormValues = {
  // "" when not set yet (a new venue). Only used by people who may assign
  // owners; for everyone else the field isn't shown and is ignored.
  ownerId: string;
  name: string;
  description: string;
  address: string;
  cityId: string;
  bookingWindowDays: number;
  holdDurationMinutes: number;
};

export type SaveVenueResult =
  | { ok: true; venueId: string }
  | { ok: false; error?: string; fieldErrors?: Partial<Record<keyof VenueInput, string>> };

// Shown when a venue doesn't exist or the user may not manage it. One
// message for both, so another owner's venue is never confirmed to exist.
const VENUE_NOT_FOUND = "This venue doesn't exist, or it isn't one you manage.";

// "Sydney, NSW, Australia" - the region is left out when a city has none.
export function formatLocation(city: { name: string; region: string | null; country: { name: string } }): string {
  return [city.name, city.region, city.country.name].filter(Boolean).join(", ");
}

// The browse page's city list is cached (lib/browse-cities.ts) and only
// lists cities that have a venue, and the search vocabulary caches the same
// tag. updateTag rather than revalidateTag: inside a Server Action it
// expires the entry immediately, so a manager who just added a venue in a
// new city sees it in the browse filters straight away.
function refreshCityCaches() {
  updateTag("browse-cities");
}

// Every platform city a venue can be in, grouped by country for the city
// dropdown. All cities, not just ones with venues (unlike the browse
// filter), since a new venue may be the first in its city. Platform data,
// the same for everyone, so no permission is involved beyond reaching the
// page that shows it.
export async function getCityOptions(): Promise<CityOptionGroup[]> {
  const cities = await prisma.city.findMany({
    orderBy: [{ country: { name: "asc" } }, { name: "asc" }],
    select: { id: true, name: true, region: true, timezone: true, country: { select: { name: true } } },
  });
  const groups = new Map<string, CityOption[]>();
  for (const city of cities) {
    const label = city.region ? `${city.name}, ${city.region}` : city.name;
    const group = groups.get(city.country.name) ?? [];
    group.push({ id: city.id, label, timezone: city.timezone });
    groups.set(city.country.name, group);
  }
  return [...groups].map(([countryName, cities]) => ({ countryName, cities }));
}

// Everyone who can own a venue, for the admin-only owner dropdown: users
// with the venue_owner role. Sorted by name, labelled with the email too so
// two people with the same name can be told apart.
export const getOwnerOptions = withPermission("venues:assign-owner", async (): Promise<OwnerOption[]> => {
  const owners = await prisma.user.findMany({
    where: { role: "venue_owner" },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: { id: true, name: true, email: true },
  });
  return owners.map((owner) => ({ id: owner.id, label: owner.name ? `${owner.name} (${owner.email})` : owner.email }));
});

// The venues this user may manage, for the Venues page: their own as an
// owner, every venue as an admin (with the owner's name).
export const listManagedVenues = withPermission("dashboard:access", async (session): Promise<ManagedVenue[]> => {
  const scope = manageableVenuesWhere(session.user);
  if (!scope) return [];
  const showOwners = can(session.user, "venues:manage-all");

  const venues = await prisma.venue.findMany({
    where: scope,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      city: { select: { name: true, region: true, country: { select: { name: true } } } },
      owner: { select: { name: true, email: true } },
      _count: { select: { listings: { where: { archivedAt: null } } } },
    },
  });
  return venues.map((venue) => ({
    id: venue.id,
    name: venue.name,
    location: formatLocation(venue.city),
    ownerName: showOwners ? (venue.owner.name ?? venue.owner.email) : null,
    activeListings: venue._count.listings,
  }));
});

// A venue's current values for the edit form, or null when it doesn't exist
// or this user may not manage it - the page shows not-found either way.
export const getVenueForEdit = withPermission(
  "venues:manage",
  async (session, venueId: string): Promise<(VenueFormValues & { id: string }) | null> => {
    if (typeof venueId !== "string" || venueId.length > 64) return null;
    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue || !canManageVenue(session.user, venue)) return null;
    return {
      id: venue.id,
      ownerId: venue.ownerId,
      name: venue.name,
      description: venue.description ?? "",
      address: venue.address,
      cityId: venue.cityId,
      bookingWindowDays: venue.bookingWindowDays,
      holdDurationMinutes: venue.holdDurationMinutes,
    };
  }
);

// Parses form input and confirms the chosen city is real. Shared by create
// and update so both apply exactly the same rules. The owner comes back
// separately (requestedOwnerId), because whether it may be used at all is
// decided by resolveOwnerId, not here - it never goes into `data`.
async function parseVenueInput(input: VenueInput) {
  const parsed = venueSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, fieldErrors: getFieldErrors(parsed.error) };
  const city = await prisma.city.findUnique({ where: { id: parsed.data.cityId }, select: { id: true } });
  if (!city) return { ok: false as const, fieldErrors: { cityId: "Choose a city from the list." } };
  const { ownerId: requestedOwnerId, ...data } = parsed.data;
  return { ok: true as const, data, requestedOwnerId };
}

// Who a venue should belong to after this save. The server decides, never
// the form:
// - Someone who may assign owners (an admin) must choose one, and it must
//   be a real user with the venue_owner role - so venues always belong to
//   a venue owner, never to an admin or a regular user.
// - Anyone else can't choose: whatever the request says is ignored, and the
//   venue keeps its owner (`keep`), or, for a new venue, belongs to them.
async function resolveOwnerId(
  actor: Actor,
  requestedOwnerId: string | undefined,
  keep: string
): Promise<{ ok: true; ownerId: string } | { ok: false; fieldErrors: { ownerId: string } }> {
  if (!can(actor, "venues:assign-owner")) return { ok: true, ownerId: keep };
  if (!requestedOwnerId) return { ok: false, fieldErrors: { ownerId: "Choose the venue's owner." } };
  const owner = await prisma.user.findUnique({ where: { id: requestedOwnerId }, select: { role: true } });
  if (owner?.role !== "venue_owner") return { ok: false, fieldErrors: { ownerId: "Choose an owner from the list." } };
  return { ok: true, ownerId: requestedOwnerId };
}

// A new venue. A venue owner adding one owns it; an admin chooses which
// venue owner it belongs to (see resolveOwnerId).
export const createVenue = withPermission(
  "venues:create",
  async (session, input: VenueInput): Promise<SaveVenueResult> => {
    const parsed = await parseVenueInput(input);
    if (!parsed.ok) return parsed;
    const owner = await resolveOwnerId(session.user, parsed.requestedOwnerId, session.user.id);
    if (!owner.ok) return owner;
    const venue = await prisma.venue.create({
      data: { ...parsed.data, ownerId: owner.ownerId },
      select: { id: true },
    });
    refreshCityCaches();
    return { ok: true, venueId: venue.id };
  }
);

// Saves changes to a venue this user may manage. The ownership check runs
// on the stored venue, before anything is written, so a crafted request
// naming someone else's venue changes nothing. Only someone who may assign
// owners can move a venue to a different owner; for anyone else the owner
// stays as it is, whatever the request contains.
export const updateVenue = withPermission(
  "venues:manage",
  async (session, venueId: string, input: VenueInput): Promise<SaveVenueResult> => {
    if (typeof venueId !== "string" || venueId.length > 64) return { ok: false, error: VENUE_NOT_FOUND };
    const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true, ownerId: true } });
    if (!venue || !canManageVenue(session.user, venue)) return { ok: false, error: VENUE_NOT_FOUND };

    const parsed = await parseVenueInput(input);
    if (!parsed.ok) return parsed;
    const owner = await resolveOwnerId(session.user, parsed.requestedOwnerId, venue.ownerId);
    if (!owner.ok) return owner;
    await prisma.venue.update({ where: { id: venue.id }, data: { ...parsed.data, ownerId: owner.ownerId } });
    refreshCityCaches();
    return { ok: true, venueId: venue.id };
  }
);
