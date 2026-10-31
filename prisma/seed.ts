/**
 * Seeds a baseline dataset for local development and demos.
 *
 * Steps run in foreign-key order (see main()). Tags, activities, countries,
 * cities and users are upserted on a unique field. Venues and listings have no
 * natural key, so main() deletes every venue first (cascading to listings and
 * overrides) and recreates them. That delete fails if any seeded listing has
 * bookings (Booking.listing is Restrict); bookings and holds are never touched.
 */

import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

/**
 * Browse quick-filter tags, linked to activities many-to-many (ActivityTag) so
 * one activity can sit under several tags.
 */
async function seedTags() {
  // Curated browse order, not alphabetical.
  const tagDefinitions = [
    { name: "Tennis", emoji: "🎾", color: "#2f9e52", displayOrder: 0 },
    { name: "Classes", emoji: "👥", color: "#7a5cc9", displayOrder: 1 },
    { name: "Fitness", emoji: "💪", color: "#d6455f", displayOrder: 2 },
    { name: "Football", emoji: "⚽", color: "#e2662d", displayOrder: 3 },
    // Table Tennis uses 🏓.
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
        // Refreshes display fields on every run, unlike the create-only
        // upserts.
        update: { emoji: tag.emoji, color: tag.color, displayOrder: tag.displayOrder },
        create: tag,
      })
    )
  );

  // Keyed by name, e.g. tagsByName.Tennis.id.
  return Object.fromEntries(tags.map((tag) => [tag.name, tag])) as Record<string, (typeof tags)[number]>;
}

/**
 * Bookable categories. bookingMechanic decides how every Listing under each one
 * is booked (see schema.prisma). "Tennis Class" (an instructor-led class,
 * fixed_session) is separate from "Tennis" (court hire, time_range).
 */
async function seedActivities() {
  // isAccommodation only matters for date_range activities.
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
        // Also set on update, so existing rows stay in sync with this list.
        update: { isAccommodation: activity.isAccommodation ?? false },
        create: activity,
      })
    )
  );

  return Object.fromEntries(activities.map((a) => [a.name, a])) as Record<string, (typeof activities)[number]>;
}

/**
 * Links activities to tags. createMany with skipDuplicates: one round trip, and
 * safe to re-run.
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

      // Tagged twice: found under both "Tennis" and "Classes".
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

/** Countries the seeded cities need. */
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
 * Cities venues can belong to: every Australian state and territory (several
 * UTC offsets and DST rules), plus three overseas cities.
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
    // Overseas cities in distinct timezones, to exercise venue-timezone logic.
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
 * Two venue owners (Alex owns venues in several cities, showing one account
 * owning many venues) and one regular user.
 *
 * Passwords come from SEED_USER_PASSWORD, never this file. When set, all three
 * accounts get it; when unset, they get none and existing passwords are left
 * alone. Local development only.
 */
async function seedUsers() {
  const password = process.env.SEED_USER_PASSWORD;
  // Same bcrypt cost as signup.
  const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;
  if (!password) {
    console.log("SEED_USER_PASSWORD not set: seeded accounts have no password (sign in won't work for them).");
  }

  // Only set when provided, so a re-run without it keeps existing passwords.
  const passwordUpdate = passwordHash ? { passwordHash } : {};

  const alex = await prisma.user.upsert({
    where: { email: "alex.owner@example.com" },
    update: passwordUpdate,
    create: { name: "Alex Nguyen", email: "alex.owner@example.com", role: "venue_owner", passwordHash },
  });

  const emma = await prisma.user.upsert({
    where: { email: "emma.owner@example.com" },
    update: passwordUpdate,
    create: { name: "Emma Collins", email: "emma.owner@example.com", role: "venue_owner", passwordHash },
  });

  const jamie = await prisma.user.upsert({
    where: { email: "jamie.user@example.com" },
    update: passwordUpdate,
    create: { name: "Jamie Rogers", email: "jamie.user@example.com", role: "user", passwordHash },
  });

  // The demo regular user behind the login page's "Log in as regular user"
  // button (DEMO_USER_EMAIL). Never has a password. Emma is the demo venue
  // owner.
  await prisma.user.upsert({
    where: { email: "demo-user@example.com" },
    update: {},
    create: { name: "Demo User Account", email: "demo-user@example.com", role: "user" },
  });

  return { alex, emma, jamie };
}

/**
 * Nine venues across seven cities: Alex owns four (Riverside, Bondi Padel,
 * Coogee Run Club, Adelaide Recreation Centre), Emma five (Green Valley,
 * FitZone, Bayside Recreation, Perth Sports Hub, Canberra Court Club).
 */
async function seedVenues(
  alexId: string,
  emmaId: string,
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
      ownerId: emmaId,
      name: "Green Valley Campground",
      address: "4 Forest Trail",
      cityId: cities["Blue Mountains"].id,
    },
  });

  const fitZone = await prisma.venue.create({
    data: { ownerId: emmaId, name: "FitZone Gym", address: "200 Collins St", cityId: cities["Melbourne"].id },
  });

  const bayside = await prisma.venue.create({
    data: {
      ownerId: emmaId,
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
    data: { ownerId: emmaId, name: "Perth Sports Hub", address: "22 Riverside Blvd", cityId: cities["Perth"].id },
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
      ownerId: emmaId,
      name: "Canberra Court Club",
      address: "9 Commonwealth Ave",
      cityId: cities["Canberra"].id,
    },
  });

  // Overseas venues, one listing each (see seedListings).
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
      ownerId: emmaId,
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
 * Bookable listings, grouped by booking mechanic; each group sets that
 * mechanic's fields on Listing.
 */
async function seedListings(
  activities: Awaited<ReturnType<typeof seedActivities>>,
  venues: Awaited<ReturnType<typeof seedVenues>>
) {
  // --- time_range: start time and length within opening hours ---

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

  // --- date_range: picked days or nights ---

  await prisma.listing.create({
    data: {
      venueId: venues.greenValley.id,
      activityId: activities["Camping"].id,
      // operatingHoursEnd is the check-in deadline; same-day stays close an
      // hour before it (isSameDayBookingClosed).
      operatingHoursStart: "08:00",
      operatingHoursEnd: "20:00",
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
      // operatingHoursEnd is the check-in deadline; same-day stays close an
      // hour before it (isSameDayBookingClosed).
      operatingHoursStart: "08:00",
      operatingHoursEnd: "20:00",
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
      // operatingHoursEnd is the check-in deadline; same-day stays close an
      // hour before it (isSameDayBookingClosed).
      operatingHoursStart: "08:00",
      operatingHoursEnd: "20:00",
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
      // operatingHoursEnd is the check-in deadline; same-day stays close an
      // hour before it (isSameDayBookingClosed).
      operatingHoursStart: "08:00",
      operatingHoursEnd: "20:00",
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
      // operatingHoursEnd is the check-in deadline; same-day stays close an
      // hour before it (isSameDayBookingClosed).
      operatingHoursStart: "08:00",
      operatingHoursEnd: "20:00",
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
      // Same-day passes stop selling an hour before closing
      // (isSameDayBookingClosed).
      operatingHoursStart: "06:00",
      operatingHoursEnd: "22:00",
      name: "Day Pass",
      capacity: 50, // many concurrent visitors, unlike an exclusive-use court
      pricePerUnit: 25,
      minDurationDays: 1,
      maxDurationDays: 1, // exactly one day - no start time, valid any time that day
    },
  });

  // --- fixed_session: one scheduled weekly occurrence ---

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

  // --- Overseas venues, one per mechanic, to exercise venue-timezone logic end
  // to end ---

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
      // Same-day passes stop selling an hour before closing
      // (isSameDayBookingClosed).
      operatingHoursStart: "06:00",
      operatingHoursEnd: "22:00",
      name: "Multi-Day Pass",
      capacity: 50,
      pricePerUnit: 35,
      // 1-5 days, to exercise the pass picker's range.
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

// Two sample overrides, since there's no admin UI to create them. Dates are
// relative to now so the block stays upcoming and the open date stays beyond
// the 30-day window.
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

  // Foreign-key order: tags, activities and countries first; then activity
  // tags, cities, users, venues, listings.
  const tags = await seedTags();
  const activities = await seedActivities();
  await linkActivityTags(activities, tags);
  const countries = await seedCountries();
  const cities = await seedCities(countries);

  // Deletes every venue so re-running doesn't duplicate them; cascades to
  // listings and overrides. Bookings are never deleted: if any exist on these
  // listings, this fails (Booking.listing is Restrict).
  await prisma.venue.deleteMany();

  const { alex, emma } = await seedUsers();
  const venues = await seedVenues(alex.id, emma.id, cities);
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