/**
 * prisma/seed.ts
 *
 * Populates the database with a realistic baseline dataset for local
 * development, demos, and manual testing of the booking flows.
 *
 * Seeding order is not arbitrary — later steps depend on records created
 * by earlier ones (a Venue needs an owning User to exist first; a Listing
 * needs both a Venue and an Activity to exist first). The `main()` function
 * at the bottom reflects that dependency chain explicitly.
 *
 * Re-run safety: Activity, User, Tag, and City rows are looked up by a
 * unique field (name/email) via `upsert`, so re-running this script won't
 * duplicate them. Venue and Listing have no natural unique field to key
 * off, so main() instead deletes every Venue before recreating them -
 * that cascades to Listing and AvailabilityOverride too (both
 * onDelete: Cascade on their venue/listing relations) - making a
 * standalone `pnpm prisma db seed` re-run safe without first needing
 * `prisma migrate reset`. Booking/BookingHold are deliberately never
 * touched by this reset.
 */

import "dotenv/config";
import { prisma } from "../lib/prisma";

/**
 * Quick-filter tags shown in the browse UI (e.g. a "Tennis" or "Classes"
 * button). Tags are intentionally decoupled from Activities via a
 * many-to-many join table (ActivityTag) — a single Activity like "Tennis
 * Class" needs to appear under both the "Tennis" filter and the "Classes"
 * filter simultaneously, which a simple one-to-many category field
 * couldn't express.
 */
async function seedTags() {
  // displayOrder is the curated browse order (Tennis first), not
  // alphabetical.
  const tagDefinitions = [
    { name: "Tennis", emoji: "🎾", color: "#2f9e52", displayOrder: 0 },
    { name: "Classes", emoji: "👥", color: "#7a5cc9", displayOrder: 1 },
    { name: "Fitness", emoji: "💪", color: "#d6455f", displayOrder: 2 },
    { name: "Football", emoji: "⚽", color: "#e2662d", displayOrder: 3 },
    // 🏸 rather than 🏓: Table Tennis below claims 🏓 as its literal emoji.
    { name: "Padel", emoji: "🏸", color: "#2c7fd1", displayOrder: 4 },
    { name: "Camping", emoji: "⛺", color: "#5c7a35", displayOrder: 5 },
    { name: "Basketball", emoji: "🏀", color: "#e8792c", displayOrder: 6 },
    { name: "Volleyball", emoji: "🏐", color: "#d4b106", displayOrder: 7 },
    { name: "Table Tennis", emoji: "🏓", color: "#1f9e96", displayOrder: 8 },
    { name: "Swimming", emoji: "🏊", color: "#1f9ed8", displayOrder: 9 },
    { name: "Cycling", emoji: "🚴", color: "#6ba82f", displayOrder: 10 },
    { name: "Running", emoji: "🏃", color: "#d1495b", displayOrder: 11 },
    { name: "Golf", emoji: "⛳", color: "#2f6e3a", displayOrder: 12 },
    { name: "Rugby", emoji: "🏉", color: "#7a4a2b", displayOrder: 13 },
    { name: "Yoga", emoji: "🧘", color: "#9b8fd1", displayOrder: 14 },
    { name: "Boxing", emoji: "🥊", color: "#b8272c", displayOrder: 15 },
    { name: "Hiking", emoji: "🥾", color: "#6b7a3a", displayOrder: 16 },
  ];

  const tags = await Promise.all(
    tagDefinitions.map((tag) =>
      prisma.tag.upsert({
        where: { name: tag.name },
        // Unlike Activity and User above, this upsert also refreshes
        // existing rows on update, since these fields are meant to be
        // editable rather than set once at creation.
        update: { emoji: tag.emoji, color: tag.color, displayOrder: tag.displayOrder },
        create: tag,
      })
    )
  );

  // Return as a lookup map keyed by name, so later code can reference
  // e.g. tagsByName.Tennis.id instead of searching the array each time.
  return Object.fromEntries(tags.map((tag) => [tag.name, tag])) as Record<string, (typeof tags)[number]>;
}

/**
 * Activity = a bookable category (Tennis, Padel, Camping, a Gym Class...).
 * `bookingMechanic` determines which booking UI and conflict-check logic
 * every Listing under this Activity uses — see schema.prisma for the full
 * explanation of each mechanic.
 *
 * Deliberately includes "Tennis Class" as a separate Activity from plain
 * "Tennis": the former is an instructor-led, capacity-limited session
 * (fixed_session), the latter is booking a court for your own use
 * (time_range). Same sport, genuinely different product and booking logic.
 */
async function seedActivities() {
  // isAccommodation only matters for date_range activities (Camping,
  // Gym Day Pass) - see the field's own comment in schema.prisma for why
  // it's a boolean here and not something richer.
  const definitions: {
    name: string;
    bookingMechanic: "time_range" | "date_range" | "fixed_session";
    isAccommodation?: boolean;
  }[] = [
    { name: "Tennis", bookingMechanic: "time_range" },
    { name: "Padel", bookingMechanic: "time_range" },
    { name: "Indoor Football", bookingMechanic: "time_range" },
    { name: "Camping", bookingMechanic: "date_range", isAccommodation: true },
    { name: "Tennis Class", bookingMechanic: "fixed_session" },
    { name: "Gym Class", bookingMechanic: "fixed_session" },
    { name: "Yoga Class", bookingMechanic: "fixed_session" },
    { name: "Basketball", bookingMechanic: "time_range" },
    { name: "Beach Volleyball", bookingMechanic: "time_range" },
    { name: "Table Tennis", bookingMechanic: "time_range" },
    { name: "Rugby", bookingMechanic: "time_range" },
    { name: "Golf", bookingMechanic: "time_range" },
    { name: "Lap Swim", bookingMechanic: "time_range" },
    { name: "Spin Class", bookingMechanic: "fixed_session" },
    { name: "Boxing Class", bookingMechanic: "fixed_session" },
    { name: "Guided Hike", bookingMechanic: "fixed_session" },
    { name: "Group Run", bookingMechanic: "fixed_session" },
    { name: "Gym Day Pass", bookingMechanic: "date_range" },
  ];

  const activities = await Promise.all(
    definitions.map((activity) =>
      prisma.activity.upsert({
        where: { name: activity.name },
        // Updates isAccommodation on every run (not just creation) so the
        // existing live Camping/Gym Day Pass rows actually pick up the
        // field now that it's been added, not just future-reset databases.
        update: { isAccommodation: activity.isAccommodation ?? false },
        create: activity,
      })
    )
  );

  return Object.fromEntries(activities.map((a) => [a.name, a])) as Record<string, (typeof activities)[number]>;
}

/**
 * Wires up which tags apply to which activities. This is where the
 * many-to-many relationship actually gets populated — everything above
 * this point just creates the two sides independently.
 *
 * `createMany` with `skipDuplicates` is used instead of individual
 * `upsert` calls per pair: it's a single round trip to the database, and
 * silently no-ops on rows that already exist rather than erroring, which
 * is desired "safe to re-run" behavior we want in a seed script.
 */
async function linkActivityTags(
  activities: Awaited<ReturnType<typeof seedActivities>>,
  tags: Awaited<ReturnType<typeof seedTags>>
) {
  await prisma.activityTag.createMany({
    skipDuplicates: true,
    data: [
      { activityId: activities["Tennis"].id, tagId: tags["Tennis"].id },
      { activityId: activities["Padel"].id, tagId: tags["Padel"].id },
      { activityId: activities["Indoor Football"].id, tagId: tags["Football"].id },
      { activityId: activities["Camping"].id, tagId: tags["Camping"].id },

      // "Tennis Class" intentionally carries two tags — this is the case
      // the whole Tag/ActivityTag design exists to support. A user
      // filtering by either "Tennis" or "Classes" should find it.
      { activityId: activities["Tennis Class"].id, tagId: tags["Tennis"].id },
      { activityId: activities["Tennis Class"].id, tagId: tags["Classes"].id },

      { activityId: activities["Gym Class"].id, tagId: tags["Classes"].id },
      { activityId: activities["Gym Class"].id, tagId: tags["Fitness"].id },
      { activityId: activities["Yoga Class"].id, tagId: tags["Classes"].id },
      { activityId: activities["Yoga Class"].id, tagId: tags["Fitness"].id },
      { activityId: activities["Yoga Class"].id, tagId: tags["Yoga"].id },

      { activityId: activities["Basketball"].id, tagId: tags["Basketball"].id },
      { activityId: activities["Beach Volleyball"].id, tagId: tags["Volleyball"].id },
      { activityId: activities["Table Tennis"].id, tagId: tags["Table Tennis"].id },
      { activityId: activities["Rugby"].id, tagId: tags["Rugby"].id },
      { activityId: activities["Golf"].id, tagId: tags["Golf"].id },
      { activityId: activities["Lap Swim"].id, tagId: tags["Swimming"].id },

      { activityId: activities["Spin Class"].id, tagId: tags["Cycling"].id },
      { activityId: activities["Spin Class"].id, tagId: tags["Classes"].id },
      { activityId: activities["Spin Class"].id, tagId: tags["Fitness"].id },
      { activityId: activities["Boxing Class"].id, tagId: tags["Boxing"].id },
      { activityId: activities["Boxing Class"].id, tagId: tags["Classes"].id },
      { activityId: activities["Boxing Class"].id, tagId: tags["Fitness"].id },

      { activityId: activities["Guided Hike"].id, tagId: tags["Hiking"].id },
      { activityId: activities["Group Run"].id, tagId: tags["Running"].id },
      { activityId: activities["Gym Day Pass"].id, tagId: tags["Fitness"].id },
    ],
  });
}

/**
 * Platform-curated countries a City belongs to (see Country in
 * schema.prisma for why this is a table rather than a free-text field on
 * City). Only the countries the seeded cities actually need - this isn't
 * trying to be an exhaustive world list.
 */
async function seedCountries() {
  const countryDefinitions = [
    { name: "Australia", code: "AU" },
    { name: "United States", code: "US" },
    { name: "United Kingdom", code: "GB" },
  ];

  const countries = await Promise.all(
    countryDefinitions.map((country) =>
      prisma.country.upsert({
        where: { name: country.name },
        update: { code: country.code },
        create: country,
      })
    )
  );

  return Object.fromEntries(countries.map((c) => [c.name, c])) as Record<string, (typeof countries)[number]>;
}

/**
 * Platform-curated cities a Venue can belong to (see City in schema.prisma
 * for why this is a table rather than a free-text field). Covers every
 * state/territory so a venue can be seeded anywhere in the country with a
 * correct timezone - ACT and most of NSW/VIC/TAS share Sydney's zone, but
 * WA, SA, QLD, and NT each observe different UTC offsets and DST rules.
 */
async function seedCities(countries: Awaited<ReturnType<typeof seedCountries>>) {
  const cityDefinitions = [
    { name: "Sydney", region: "NSW", timezone: "Australia/Sydney", country: "Australia" },
    { name: "Melbourne", region: "VIC", timezone: "Australia/Melbourne", country: "Australia" },
    { name: "Brisbane", region: "QLD", timezone: "Australia/Brisbane", country: "Australia" },
    { name: "Blue Mountains", region: "NSW", timezone: "Australia/Sydney", country: "Australia" },
    { name: "Perth", region: "WA", timezone: "Australia/Perth", country: "Australia" },
    { name: "Adelaide", region: "SA", timezone: "Australia/Adelaide", country: "Australia" },
    { name: "Canberra", region: "ACT", timezone: "Australia/Sydney", country: "Australia" },
    { name: "Hobart", region: "TAS", timezone: "Australia/Hobart", country: "Australia" },
    { name: "Darwin", region: "NT", timezone: "Australia/Darwin", country: "Australia" },
    { name: "Gold Coast", region: "QLD", timezone: "Australia/Brisbane", country: "Australia" },
    { name: "Newcastle", region: "NSW", timezone: "Australia/Sydney", country: "Australia" },
    { name: "Wollongong", region: "NSW", timezone: "Australia/Sydney", country: "Australia" },
    { name: "Cairns", region: "QLD", timezone: "Australia/Brisbane", country: "Australia" },
    { name: "Geelong", region: "VIC", timezone: "Australia/Melbourne", country: "Australia" },
    // Three non-Australian cities, each in a genuinely different timezone,
    // specifically to exercise venue-timezone-aware booking logic (see
    // lib/dates.ts's todayInTimezone and lib/time-of-day.ts's
    // zonedOccurrenceStart) against something other than every other
    // seeded venue's shared Australian offset.
    { name: "Los Angeles", region: "CA", timezone: "America/Los_Angeles", country: "United States" },
    { name: "Manhattan", region: "NY", timezone: "America/New_York", country: "United States" },
    { name: "London", region: null, timezone: "Europe/London", country: "United Kingdom" },
  ];

  const cities = await Promise.all(
    cityDefinitions.map((city) =>
      prisma.city.upsert({
        where: { name: city.name },
        update: { region: city.region, timezone: city.timezone, countryId: countries[city.country].id },
        create: {
          name: city.name,
          region: city.region,
          timezone: city.timezone,
          countryId: countries[city.country].id,
        },
      })
    )
  );

  return Object.fromEntries(cities.map((c) => [c.name, c])) as Record<string, (typeof cities)[number]>;
}

/**
 * Seeds two venue-owner accounts and one regular end-user account.
 *
 * Alex is deliberately given two venues in different cities further down
 * in seedVenues() — this proves out the platform's "one account, many
 * venues" ownership model (Venue.ownerId) rather than just asserting it
 * works in theory.
 */
async function seedUsers() {
  const alex = await prisma.user.upsert({
    where: { email: "alex.owner@example.com" },
    update: {},
    create: { name: "Alex Nguyen", email: "alex.owner@example.com", role: "venue_owner" },
  });

  const priya = await prisma.user.upsert({
    where: { email: "priya.owner@example.com" },
    update: {},
    create: { name: "Priya Kapoor", email: "priya.owner@example.com", role: "venue_owner" },
  });

  const jamie = await prisma.user.upsert({
    where: { email: "jamie.user@example.com" },
    update: {},
    create: { name: "Jamie Rogers", email: "jamie.user@example.com", role: "user" },
  });

  return { alex, priya, jamie };
}

/**
 * Seeds nine venues across seven cities, split between the two owners
 * created in seedUsers(). Alex owns four (Riverside, Bondi Padel, Coogee
 * Run Club, Adelaide Recreation Centre); Priya owns five (Green Valley,
 * FitZone, Bayside Recreation, Perth Sports Hub, Canberra Court Club) —
 * entirely separate from Alex's. Perth/Adelaide/Canberra exist mainly to
 * spread the extra court-type listings below across more than one venue
 * per activity, rather than stacking five basketball courts at one club.
 */
async function seedVenues(
  alexId: string,
  priyaId: string,
  cities: Awaited<ReturnType<typeof seedCities>>
) {
  const riverside = await prisma.venue.create({
    data: { ownerId: alexId, name: "Riverside Sports Club", address: "12 Riverside Ave", cityId: cities["Sydney"].id },
  });

  const bondiPadel = await prisma.venue.create({
    data: { ownerId: alexId, name: "Bondi Padel Center", address: "88 Beach Rd", cityId: cities["Sydney"].id },
  });

  const greenValley = await prisma.venue.create({
    data: {
      ownerId: priyaId,
      name: "Green Valley Campground",
      address: "4 Forest Trail",
      cityId: cities["Blue Mountains"].id,
    },
  });

  const fitZone = await prisma.venue.create({
    data: { ownerId: priyaId, name: "FitZone Gym", address: "200 Collins St", cityId: cities["Melbourne"].id },
  });

  const bayside = await prisma.venue.create({
    data: {
      ownerId: priyaId,
      name: "Bayside Recreation Centre",
      address: "10 Bayside Drive",
      cityId: cities["Brisbane"].id,
    },
  });

  const coogeeRunClub = await prisma.venue.create({
    data: {
      ownerId: alexId,
      name: "Coogee Run Club",
      address: "1 Beach St, Coogee Beach",
      cityId: cities["Sydney"].id,
    },
  });

  const perthSportsHub = await prisma.venue.create({
    data: { ownerId: priyaId, name: "Perth Sports Hub", address: "22 Riverside Blvd", cityId: cities["Perth"].id },
  });

  const adelaideRecreation = await prisma.venue.create({
    data: {
      ownerId: alexId,
      name: "Adelaide Recreation Centre",
      address: "5 Rundle Street",
      cityId: cities["Adelaide"].id,
    },
  });

  const canberraCourtClub = await prisma.venue.create({
    data: {
      ownerId: priyaId,
      name: "Canberra Court Club",
      address: "9 Commonwealth Ave",
      cityId: cities["Canberra"].id,
    },
  });

  // Three venues in genuinely different, non-Australian timezones - see
  // seedListings below for the one listing each exercises.
  const losAngelesCourts = await prisma.venue.create({
    data: {
      ownerId: alexId,
      name: "Sunset Tennis Courts",
      address: "7100 Sunset Blvd",
      cityId: cities["Los Angeles"].id,
    },
  });

  const manhattanFitness = await prisma.venue.create({
    data: {
      ownerId: priyaId,
      name: "Midtown Fitness Club",
      address: "350 5th Ave",
      cityId: cities["Manhattan"].id,
    },
  });

  const londonStudio = await prisma.venue.create({
    data: {
      ownerId: alexId,
      name: "Shoreditch Yoga Studio",
      address: "15 Old Street",
      cityId: cities["London"].id,
    },
  });

  return {
    riverside,
    bondiPadel,
    greenValley,
    fitZone,
    bayside,
    coogeeRunClub,
    perthSportsHub,
    adelaideRecreation,
    canberraCourtClub,
    losAngelesCourts,
    manhattanFitness,
    londonStudio,
  };
}

/**
 * Seeds the actual bookable Listings, one per Activity/Venue combination.
 * Grouped by booking mechanic below to make clear that each group requires
 * a different set of availability fields on Listing — see schema.prisma
 * for why each field group only applies to its corresponding mechanic.
 */
async function seedListings(
  activities: Awaited<ReturnType<typeof seedActivities>>,
  venues: Awaited<ReturnType<typeof seedVenues>>
) {
  // --- time_range: user chooses a start time + duration within bounds ---

  const court1 = await prisma.listing.create({
    data: {
      venueId: venues.riverside.id,
      activityId: activities["Tennis"].id,
      name: "Court 1",
      capacity: 1, // exclusive use: only one booking can hold this court at a time
      pricePerUnit: 20,
      operatingHoursStart: "09:00",
      operatingHoursEnd: "21:00",
      minDurationMinutes: 30,
      maxDurationMinutes: 120,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.riverside.id,
      activityId: activities["Tennis"].id,
      name: "Court 2",
      capacity: 1,
      pricePerUnit: 20,
      operatingHoursStart: "09:00",
      operatingHoursEnd: "21:00",
      minDurationMinutes: 30,
      maxDurationMinutes: 120,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.riverside.id,
      activityId: activities["Tennis"].id,
      name: "Court 3",
      capacity: 1,
      pricePerUnit: 22,
      operatingHoursStart: "09:00",
      operatingHoursEnd: "21:00",
      minDurationMinutes: 30,
      maxDurationMinutes: 120,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.riverside.id,
      activityId: activities["Tennis"].id,
      name: "Court 4",
      capacity: 1,
      pricePerUnit: 22,
      operatingHoursStart: "09:00",
      operatingHoursEnd: "21:00",
      minDurationMinutes: 30,
      maxDurationMinutes: 120,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.bondiPadel.id,
      activityId: activities["Padel"].id,
      name: "Padel Court 1",
      capacity: 1,
      pricePerUnit: 60,
      operatingHoursStart: "07:00",
      operatingHoursEnd: "22:00",
      minDurationMinutes: 60,
      maxDurationMinutes: 90,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.bondiPadel.id,
      activityId: activities["Padel"].id,
      name: "Padel Court 2",
      capacity: 1,
      pricePerUnit: 60,
      operatingHoursStart: "07:00",
      operatingHoursEnd: "22:00",
      minDurationMinutes: 60,
      maxDurationMinutes: 90,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.bondiPadel.id,
      activityId: activities["Padel"].id,
      name: "Padel Court 3",
      capacity: 1,
      pricePerUnit: 65,
      operatingHoursStart: "07:00",
      operatingHoursEnd: "22:00",
      minDurationMinutes: 60,
      maxDurationMinutes: 90,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.perthSportsHub.id,
      activityId: activities["Padel"].id,
      name: "Padel Court 1",
      capacity: 1,
      pricePerUnit: 55,
      operatingHoursStart: "08:00",
      operatingHoursEnd: "21:00",
      minDurationMinutes: 60,
      maxDurationMinutes: 90,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.perthSportsHub.id,
      activityId: activities["Padel"].id,
      name: "Padel Court 2",
      capacity: 1,
      pricePerUnit: 55,
      operatingHoursStart: "08:00",
      operatingHoursEnd: "21:00",
      minDurationMinutes: 60,
      maxDurationMinutes: 90,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.riverside.id,
      activityId: activities["Indoor Football"].id,
      name: "Indoor Pitch",
      capacity: 1,
      pricePerUnit: 60,
      operatingHoursStart: "08:00",
      operatingHoursEnd: "23:00",
      minDurationMinutes: 60,
      maxDurationMinutes: 120,
      incrementMinutes: 60,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.riverside.id,
      activityId: activities["Indoor Football"].id,
      name: "Indoor Pitch 2",
      capacity: 1,
      pricePerUnit: 65,
      operatingHoursStart: "08:00",
      operatingHoursEnd: "23:00",
      minDurationMinutes: 60,
      maxDurationMinutes: 120,
      incrementMinutes: 60,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.perthSportsHub.id,
      activityId: activities["Indoor Football"].id,
      name: "Football Pitch",
      capacity: 1,
      pricePerUnit: 58,
      operatingHoursStart: "08:00",
      operatingHoursEnd: "22:00",
      minDurationMinutes: 60,
      maxDurationMinutes: 120,
      incrementMinutes: 60,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.adelaideRecreation.id,
      activityId: activities["Indoor Football"].id,
      name: "Football Pitch",
      capacity: 1,
      pricePerUnit: 55,
      operatingHoursStart: "08:00",
      operatingHoursEnd: "22:00",
      minDurationMinutes: 60,
      maxDurationMinutes: 120,
      incrementMinutes: 60,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.canberraCourtClub.id,
      activityId: activities["Indoor Football"].id,
      name: "Football Pitch",
      capacity: 1,
      pricePerUnit: 60,
      operatingHoursStart: "08:00",
      operatingHoursEnd: "22:00",
      minDurationMinutes: 60,
      maxDurationMinutes: 120,
      incrementMinutes: 60,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.riverside.id,
      activityId: activities["Basketball"].id,
      name: "Basketball Court",
      capacity: 1,
      pricePerUnit: 25,
      operatingHoursStart: "08:00",
      operatingHoursEnd: "22:00",
      minDurationMinutes: 30,
      maxDurationMinutes: 90,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.riverside.id,
      activityId: activities["Basketball"].id,
      name: "Basketball Court 2",
      capacity: 1,
      pricePerUnit: 25,
      operatingHoursStart: "08:00",
      operatingHoursEnd: "22:00",
      minDurationMinutes: 30,
      maxDurationMinutes: 90,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.perthSportsHub.id,
      activityId: activities["Basketball"].id,
      name: "Basketball Court",
      capacity: 1,
      pricePerUnit: 28,
      operatingHoursStart: "08:00",
      operatingHoursEnd: "22:00",
      minDurationMinutes: 30,
      maxDurationMinutes: 90,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.adelaideRecreation.id,
      activityId: activities["Basketball"].id,
      name: "Basketball Court",
      capacity: 1,
      pricePerUnit: 24,
      operatingHoursStart: "08:00",
      operatingHoursEnd: "22:00",
      minDurationMinutes: 30,
      maxDurationMinutes: 90,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.canberraCourtClub.id,
      activityId: activities["Basketball"].id,
      name: "Basketball Court",
      capacity: 1,
      pricePerUnit: 26,
      operatingHoursStart: "08:00",
      operatingHoursEnd: "22:00",
      minDurationMinutes: 30,
      maxDurationMinutes: 90,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.bondiPadel.id,
      activityId: activities["Beach Volleyball"].id,
      name: "Beach Volleyball Court",
      capacity: 1,
      pricePerUnit: 30,
      operatingHoursStart: "07:00",
      operatingHoursEnd: "22:00",
      minDurationMinutes: 60,
      maxDurationMinutes: 90,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.bondiPadel.id,
      activityId: activities["Beach Volleyball"].id,
      name: "Beach Volleyball Court 2",
      capacity: 1,
      pricePerUnit: 32,
      operatingHoursStart: "07:00",
      operatingHoursEnd: "22:00",
      minDurationMinutes: 60,
      maxDurationMinutes: 90,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.perthSportsHub.id,
      activityId: activities["Beach Volleyball"].id,
      name: "Volleyball Court",
      capacity: 1,
      pricePerUnit: 30,
      operatingHoursStart: "08:00",
      operatingHoursEnd: "21:00",
      minDurationMinutes: 60,
      maxDurationMinutes: 90,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.adelaideRecreation.id,
      activityId: activities["Beach Volleyball"].id,
      name: "Volleyball Court",
      capacity: 1,
      pricePerUnit: 28,
      operatingHoursStart: "08:00",
      operatingHoursEnd: "21:00",
      minDurationMinutes: 60,
      maxDurationMinutes: 90,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.canberraCourtClub.id,
      activityId: activities["Beach Volleyball"].id,
      name: "Volleyball Court",
      capacity: 1,
      pricePerUnit: 29,
      operatingHoursStart: "08:00",
      operatingHoursEnd: "21:00",
      minDurationMinutes: 60,
      maxDurationMinutes: 90,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.riverside.id,
      activityId: activities["Table Tennis"].id,
      name: "Table Tennis Table",
      capacity: 1,
      pricePerUnit: 10,
      operatingHoursStart: "09:00",
      operatingHoursEnd: "21:00",
      minDurationMinutes: 30,
      maxDurationMinutes: 60,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.riverside.id,
      activityId: activities["Table Tennis"].id,
      name: "Table Tennis Table 2",
      capacity: 1,
      pricePerUnit: 10,
      operatingHoursStart: "09:00",
      operatingHoursEnd: "21:00",
      minDurationMinutes: 30,
      maxDurationMinutes: 60,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.perthSportsHub.id,
      activityId: activities["Table Tennis"].id,
      name: "Table Tennis Table",
      capacity: 1,
      pricePerUnit: 12,
      operatingHoursStart: "09:00",
      operatingHoursEnd: "21:00",
      minDurationMinutes: 30,
      maxDurationMinutes: 60,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.adelaideRecreation.id,
      activityId: activities["Table Tennis"].id,
      name: "Table Tennis Table",
      capacity: 1,
      pricePerUnit: 10,
      operatingHoursStart: "09:00",
      operatingHoursEnd: "21:00",
      minDurationMinutes: 30,
      maxDurationMinutes: 60,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.canberraCourtClub.id,
      activityId: activities["Table Tennis"].id,
      name: "Table Tennis Table",
      capacity: 1,
      pricePerUnit: 11,
      operatingHoursStart: "09:00",
      operatingHoursEnd: "21:00",
      minDurationMinutes: 30,
      maxDurationMinutes: 60,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.riverside.id,
      activityId: activities["Rugby"].id,
      name: "Rugby Pitch",
      capacity: 1,
      pricePerUnit: 70,
      operatingHoursStart: "08:00",
      operatingHoursEnd: "20:00",
      minDurationMinutes: 60,
      maxDurationMinutes: 120,
      incrementMinutes: 60,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.riverside.id,
      activityId: activities["Rugby"].id,
      name: "Rugby Pitch 2",
      capacity: 1,
      pricePerUnit: 72,
      operatingHoursStart: "08:00",
      operatingHoursEnd: "20:00",
      minDurationMinutes: 60,
      maxDurationMinutes: 120,
      incrementMinutes: 60,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.perthSportsHub.id,
      activityId: activities["Rugby"].id,
      name: "Rugby Pitch",
      capacity: 1,
      pricePerUnit: 68,
      operatingHoursStart: "08:00",
      operatingHoursEnd: "20:00",
      minDurationMinutes: 60,
      maxDurationMinutes: 120,
      incrementMinutes: 60,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.adelaideRecreation.id,
      activityId: activities["Rugby"].id,
      name: "Rugby Pitch",
      capacity: 1,
      pricePerUnit: 65,
      operatingHoursStart: "08:00",
      operatingHoursEnd: "20:00",
      minDurationMinutes: 60,
      maxDurationMinutes: 120,
      incrementMinutes: 60,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.canberraCourtClub.id,
      activityId: activities["Rugby"].id,
      name: "Rugby Pitch",
      capacity: 1,
      pricePerUnit: 70,
      operatingHoursStart: "08:00",
      operatingHoursEnd: "20:00",
      minDurationMinutes: 60,
      maxDurationMinutes: 120,
      incrementMinutes: 60,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.bayside.id,
      activityId: activities["Golf"].id,
      name: "Golf Bay 1",
      capacity: 1,
      pricePerUnit: 35,
      operatingHoursStart: "07:00",
      operatingHoursEnd: "19:00",
      minDurationMinutes: 30,
      maxDurationMinutes: 120,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.bayside.id,
      activityId: activities["Golf"].id,
      name: "Golf Bay 2",
      capacity: 1,
      pricePerUnit: 35,
      operatingHoursStart: "07:00",
      operatingHoursEnd: "19:00",
      minDurationMinutes: 30,
      maxDurationMinutes: 120,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.bayside.id,
      activityId: activities["Golf"].id,
      name: "Golf Bay 3",
      capacity: 1,
      pricePerUnit: 38,
      operatingHoursStart: "07:00",
      operatingHoursEnd: "19:00",
      minDurationMinutes: 30,
      maxDurationMinutes: 120,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.perthSportsHub.id,
      activityId: activities["Golf"].id,
      name: "Golf Bay",
      capacity: 1,
      pricePerUnit: 32,
      operatingHoursStart: "07:00",
      operatingHoursEnd: "19:00",
      minDurationMinutes: 30,
      maxDurationMinutes: 120,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.adelaideRecreation.id,
      activityId: activities["Golf"].id,
      name: "Golf Bay",
      capacity: 1,
      pricePerUnit: 34,
      operatingHoursStart: "07:00",
      operatingHoursEnd: "19:00",
      minDurationMinutes: 30,
      maxDurationMinutes: 120,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.bayside.id,
      activityId: activities["Lap Swim"].id,
      name: "Lap Swim Lane 1",
      capacity: 1, // one lane per booking, exclusive use like a court
      pricePerUnit: 15,
      operatingHoursStart: "06:00",
      operatingHoursEnd: "21:00",
      minDurationMinutes: 30,
      maxDurationMinutes: 60,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.bayside.id,
      activityId: activities["Lap Swim"].id,
      name: "Lap Swim Lane 2",
      capacity: 1,
      pricePerUnit: 15,
      operatingHoursStart: "06:00",
      operatingHoursEnd: "21:00",
      minDurationMinutes: 30,
      maxDurationMinutes: 60,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.bayside.id,
      activityId: activities["Lap Swim"].id,
      name: "Lap Swim Lane 3",
      capacity: 1,
      pricePerUnit: 15,
      operatingHoursStart: "06:00",
      operatingHoursEnd: "21:00",
      minDurationMinutes: 30,
      maxDurationMinutes: 60,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.perthSportsHub.id,
      activityId: activities["Lap Swim"].id,
      name: "Lap Swim Lane",
      capacity: 1,
      pricePerUnit: 16,
      operatingHoursStart: "06:00",
      operatingHoursEnd: "20:00",
      minDurationMinutes: 30,
      maxDurationMinutes: 60,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.adelaideRecreation.id,
      activityId: activities["Lap Swim"].id,
      name: "Lap Swim Lane",
      capacity: 1,
      pricePerUnit: 14,
      operatingHoursStart: "06:00",
      operatingHoursEnd: "20:00",
      minDurationMinutes: 30,
      maxDurationMinutes: 60,
      incrementMinutes: 30,
    },
  });

  // --- date_range: user chooses a start date + end date ---

  await prisma.listing.create({
    data: {
      venueId: venues.greenValley.id,
      activityId: activities["Camping"].id,
      name: "Campsite A",
      capacity: 1, // one booking occupies the entire site for its date range
      pricePerUnit: 45, // priced per night
      minDurationDays: 1,
      maxDurationDays: 14,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.greenValley.id,
      activityId: activities["Camping"].id,
      name: "Campsite B",
      capacity: 1,
      pricePerUnit: 45,
      minDurationDays: 1,
      maxDurationDays: 7,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.greenValley.id,
      activityId: activities["Camping"].id,
      name: "Campsite C",
      capacity: 1,
      pricePerUnit: 45,
      minDurationDays: 1,
      maxDurationDays: 14,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.greenValley.id,
      activityId: activities["Camping"].id,
      name: "Campsite D",
      capacity: 1,
      pricePerUnit: 50,
      minDurationDays: 1,
      maxDurationDays: 10,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.greenValley.id,
      activityId: activities["Camping"].id,
      name: "Campsite E",
      capacity: 1,
      pricePerUnit: 40,
      minDurationDays: 1,
      maxDurationDays: 7,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.fitZone.id,
      activityId: activities["Gym Day Pass"].id,
      name: "Day Pass",
      capacity: 50, // many concurrent visitors, unlike an exclusive-use court
      pricePerUnit: 25,
      minDurationDays: 1,
      maxDurationDays: 1, // exactly one day - no start time, valid any time that day
    },
  });

  // --- fixed_session: user books into one specific scheduled occurrence ---

  await prisma.listing.create({
    data: {
      venueId: venues.riverside.id,
      activityId: activities["Tennis Class"].id,
      name: "Saturday 10am Tennis Class (Advanced)",
      capacity: 8,
      pricePerUnit: 25,
      recurrenceDayOfWeek: 6, // 0 = Sunday ... 6 = Saturday
      recurrenceStartTime: "10:00",
      sessionDurationMinutes: 60,
    },
  });

  const mondayHiit = await prisma.listing.create({
    data: {
      venueId: venues.fitZone.id,
      activityId: activities["Gym Class"].id,
      name: "Monday 6pm HIIT",
      capacity: 20, // up to 20 people can book this exact session
      pricePerUnit: 15,
      recurrenceDayOfWeek: 1, // Monday
      recurrenceStartTime: "18:00",
      sessionDurationMinutes: 45,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.fitZone.id,
      activityId: activities["Gym Class"].id,
      name: "Wednesday 6pm HIIT",
      capacity: 20,
      pricePerUnit: 15,
      recurrenceDayOfWeek: 3, // Wednesday
      recurrenceStartTime: "18:00",
      sessionDurationMinutes: 45,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.fitZone.id,
      activityId: activities["Yoga Class"].id,
      name: "Tuesday 7am Yoga",
      capacity: 15,
      pricePerUnit: 12,
      recurrenceDayOfWeek: 2, // Tuesday
      recurrenceStartTime: "07:00",
      sessionDurationMinutes: 60,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.fitZone.id,
      activityId: activities["Yoga Class"].id,
      name: "Thursday 6pm Yoga",
      capacity: 15,
      pricePerUnit: 12,
      recurrenceDayOfWeek: 4, // Thursday
      recurrenceStartTime: "18:00",
      sessionDurationMinutes: 60,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.fitZone.id,
      activityId: activities["Yoga Class"].id,
      name: "Sunday 8am Yoga",
      capacity: 15,
      pricePerUnit: 14,
      recurrenceDayOfWeek: 0, // Sunday
      recurrenceStartTime: "08:00",
      sessionDurationMinutes: 60,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.fitZone.id,
      activityId: activities["Spin Class"].id,
      name: "Thursday 6pm Spin",
      capacity: 20,
      pricePerUnit: 18,
      recurrenceDayOfWeek: 4, // Thursday
      recurrenceStartTime: "18:00",
      sessionDurationMinutes: 45,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.fitZone.id,
      activityId: activities["Spin Class"].id,
      name: "Tuesday 7am Spin",
      capacity: 20,
      pricePerUnit: 18,
      recurrenceDayOfWeek: 2, // Tuesday
      recurrenceStartTime: "07:00",
      sessionDurationMinutes: 45,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.fitZone.id,
      activityId: activities["Spin Class"].id,
      name: "Saturday 9am Spin",
      capacity: 20,
      pricePerUnit: 18,
      recurrenceDayOfWeek: 6, // Saturday
      recurrenceStartTime: "09:00",
      sessionDurationMinutes: 45,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.fitZone.id,
      activityId: activities["Boxing Class"].id,
      name: "Friday 6pm Boxing",
      capacity: 15,
      pricePerUnit: 20,
      recurrenceDayOfWeek: 5, // Friday
      recurrenceStartTime: "18:00",
      sessionDurationMinutes: 45,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.fitZone.id,
      activityId: activities["Boxing Class"].id,
      name: "Monday 7pm Boxing",
      capacity: 15,
      pricePerUnit: 20,
      recurrenceDayOfWeek: 1, // Monday
      recurrenceStartTime: "19:00",
      sessionDurationMinutes: 45,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.fitZone.id,
      activityId: activities["Boxing Class"].id,
      name: "Saturday 10am Boxing",
      capacity: 15,
      pricePerUnit: 22,
      recurrenceDayOfWeek: 6, // Saturday
      recurrenceStartTime: "10:00",
      sessionDurationMinutes: 45,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.greenValley.id,
      activityId: activities["Guided Hike"].id,
      name: "Saturday 8am Guided Hike",
      capacity: null, // free and open to any group size
      pricePerUnit: 0,
      recurrenceDayOfWeek: 6, // Saturday
      recurrenceStartTime: "08:00",
      sessionDurationMinutes: 180,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.greenValley.id,
      activityId: activities["Guided Hike"].id,
      name: "Wednesday 2pm Guided Hike",
      capacity: null,
      pricePerUnit: 0,
      recurrenceDayOfWeek: 3, // Wednesday
      recurrenceStartTime: "14:00",
      sessionDurationMinutes: 120,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.greenValley.id,
      activityId: activities["Guided Hike"].id,
      name: "Sunday 9am Guided Hike",
      capacity: null,
      pricePerUnit: 0,
      recurrenceDayOfWeek: 0, // Sunday
      recurrenceStartTime: "09:00",
      sessionDurationMinutes: 150,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.coogeeRunClub.id,
      activityId: activities["Group Run"].id,
      name: "Saturday 7am Group Run",
      capacity: null,
      pricePerUnit: 0,
      recurrenceDayOfWeek: 6, // Saturday
      recurrenceStartTime: "07:00",
      sessionDurationMinutes: 60,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.coogeeRunClub.id,
      activityId: activities["Group Run"].id,
      name: "Wednesday 6pm Group Run",
      capacity: null,
      pricePerUnit: 0,
      recurrenceDayOfWeek: 3, // Wednesday
      recurrenceStartTime: "18:00",
      sessionDurationMinutes: 60,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.coogeeRunClub.id,
      activityId: activities["Group Run"].id,
      name: "Sunday 8am Group Run",
      capacity: null,
      pricePerUnit: 0,
      recurrenceDayOfWeek: 0, // Sunday
      recurrenceStartTime: "08:00",
      sessionDurationMinutes: 60,
    },
  });

  // --- Three non-Australian venues, one per mechanic, specifically to
  // exercise venue-timezone-aware booking logic end to end (see
  // seedCities above and seedVenues' losAngelesCourts/manhattanFitness/
  // londonStudio) ---

  await prisma.listing.create({
    data: {
      venueId: venues.losAngelesCourts.id,
      activityId: activities["Tennis"].id,
      name: "Court 1",
      capacity: 1,
      pricePerUnit: 28,
      operatingHoursStart: "09:00",
      operatingHoursEnd: "21:00",
      minDurationMinutes: 30,
      maxDurationMinutes: 120,
      incrementMinutes: 30,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.manhattanFitness.id,
      activityId: activities["Gym Day Pass"].id,
      name: "Multi-Day Pass",
      capacity: 50,
      pricePerUnit: 35,
      // 1-5 days (not exactly one) - deliberately exercises the pass
      // picker's min/max range rather than the single-day case Day Pass
      // above already covers.
      minDurationDays: 1,
      maxDurationDays: 5,
    },
  });

  await prisma.listing.create({
    data: {
      venueId: venues.londonStudio.id,
      activityId: activities["Yoga Class"].id,
      name: "Tuesday 7pm Yoga Class",
      capacity: 15,
      pricePerUnit: 18,
      recurrenceDayOfWeek: 2, // Tuesday
      recurrenceStartTime: "19:00",
      sessionDurationMinutes: 60,
    },
  });

  return { court1, mondayHiit };
}

function daysFromNowUTC(days: number): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days));
}

function nextWeekdayOnOrAfter(date: Date, weekday: number): Date {
  const diff = (weekday - date.getUTCDay() + 7) % 7;
  return new Date(date.getTime() + diff * 24 * 60 * 60 * 1000);
}

// Two sample rows so lib/availability.ts's override resolution actually
// has something to resolve - there's no admin UI to create these yet, so
// without seed data this whole code path would be untested. Dates are
// computed relative to "now" rather than hardcoded, so they stay
// meaningful (block still upcoming, open still past the 30-day window)
// no matter when the seed script runs.
async function seedAvailabilityOverrides(listings: Awaited<ReturnType<typeof seedListings>>) {
  await prisma.availabilityOverride.create({
    data: {
      listingId: listings.court1.id,
      kind: "block",
      startDate: daysFromNowUTC(5),
      reason: "Court closed for resurfacing",
    },
  });

  await prisma.availabilityOverride.create({
    data: {
      listingId: listings.mondayHiit.id,
      kind: "open",
      startDate: nextWeekdayOnOrAfter(daysFromNowUTC(45), 1), // a Monday, well past the default 30-day window
      reason: "Special extra session",
    },
  });
}

async function main() {
  console.log("Seeding database...");

  // Order reflects real foreign-key dependencies: Tags, Activities, and
  // Countries have none, so they go first; linking activities to tags
  // requires both to already exist; Cities require a Country; Venues
  // require Users and a City; Listings require both Venues and Activities.
  const tags = await seedTags();
  const activities = await seedActivities();
  await linkActivityTags(activities, tags);
  const countries = await seedCountries();
  const cities = await seedCities(countries);

  // Tags/Activities/Users above all upsert on a natural key, so re-running
  // this script is already safe for them - Venue has no such key (its
  // name isn't unique across cities) and seedVenues/seedListings/
  // seedAvailabilityOverrides below just prisma.create() plain rows, so
  // without this reset, every standalone `pnpm prisma db seed` run (i.e.
  // one not preceded by `migrate reset`) would pile on another full copy.
  // Deleting Venue cascades to Listing and AvailabilityOverride (both
  // onDelete: Cascade on their venue/listing relations), so this one call
  // is enough to clear all three. Booking/BookingHold are left completely
  // alone - real booking history must never be wiped by a reseed - which
  // is safe here only because nothing above touches them; if that ever
  // changes, this still can't violate Booking.listing's onDelete:
  // Restrict unless Bookings against seed listings exist, in which case
  // this would correctly fail loudly rather than silently orphan them.
  await prisma.venue.deleteMany();

  const { alex, priya } = await seedUsers();
  const venues = await seedVenues(alex.id, priya.id, cities);
  const listings = await seedListings(activities, venues);
  await seedAvailabilityOverrides(listings);

  console.log("Seeding complete: 17 tags, 18 activities, 3 countries, 17 cities, 3 users, 12 venues, 71 listings.");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());