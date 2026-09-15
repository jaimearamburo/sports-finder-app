/**
 * prisma/seed.ts
 *
 * Populates the database with a realistic baseline dataset for local
 * development, demos, and manual testing of the booking flows.
 *
 * Seeding order is not arbitrary — later steps depend on records created
 * by earlier ones (a Venue needs an owning User to exist first; a Resource
 * needs both a Venue and an Activity to exist first). The `main()` function
 * at the bottom reflects that dependency chain explicitly.
 *
 * Re-run safety: Activity, User, and Tag rows are looked up by a unique
 * field (name/email) via `upsert`, so re-running this script won't
 * duplicate them. Venue and Resource have no natural unique field to key
 * off, so re-running without first resetting the database (`prisma migrate
 * reset`) will create duplicate venues/resources — that's expected during
 * local development.
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
    { name: "Padel", emoji: "🏓", color: "#2c7fd1", displayOrder: 4 },
    { name: "Camping", emoji: "⛺", color: "#5c7a35", displayOrder: 5 },
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
 * every Resource under this Activity uses — see schema.prisma for the full
 * explanation of each mechanic.
 *
 * Deliberately includes "Tennis Class" as a separate Activity from plain
 * "Tennis": the former is an instructor-led, capacity-limited session
 * (fixed_session), the latter is booking a court for your own use
 * (time_range). Same sport, genuinely different product and booking logic.
 */
async function seedActivities() {
  const definitions = [
    { name: "Tennis", bookingMechanic: "time_range" as const },
    { name: "Padel", bookingMechanic: "time_range" as const },
    { name: "Indoor Football", bookingMechanic: "time_range" as const },
    { name: "Camping", bookingMechanic: "date_range" as const },
    { name: "Tennis Class", bookingMechanic: "fixed_session" as const },
    { name: "Gym Class", bookingMechanic: "fixed_session" as const },
    { name: "Yoga Class", bookingMechanic: "fixed_session" as const },
  ];

  const activities = await Promise.all(
    definitions.map((activity) =>
      prisma.activity.upsert({
        where: { name: activity.name },
        update: {},
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
    ],
  });
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
    create: { name: "Jamie Rogers", email: "jaime.user@example.com", role: "user" },
  });

  return { alex, priya, jamie };
}

/**
 * Seeds four venues across three cities, split between the two owners
 * created in seedUsers(). Alex owns two (Riverside, Bondi Padel); Priya
 * owns two (Green Valley, FitZone) — entirely separate from Alex's.
 */
async function seedVenues(alexId: string, priyaId: string) {
  const riverside = await prisma.venue.create({
    data: { ownerId: alexId, name: "Riverside Sports Club", address: "12 Riverside Ave", city: "Sydney" },
  });

  const bondiPadel = await prisma.venue.create({
    data: { ownerId: alexId, name: "Bondi Padel Center", address: "88 Beach Rd", city: "Sydney" },
  });

  const greenValley = await prisma.venue.create({
    data: { ownerId: priyaId, name: "Green Valley Campground", address: "4 Forest Trail", city: "Blue Mountains" },
  });

  const fitZone = await prisma.venue.create({
    data: { ownerId: priyaId, name: "FitZone Gym", address: "200 Collins St", city: "Melbourne" },
  });

  return { riverside, bondiPadel, greenValley, fitZone };
}

/**
 * Seeds the actual bookable Resources, one per Activity/Venue combination.
 * Grouped by booking mechanic below to make clear that each group requires
 * a different set of availability fields on Resource — see schema.prisma
 * for why each field group only applies to its corresponding mechanic.
 */
async function seedResources(
  activities: Awaited<ReturnType<typeof seedActivities>>,
  venues: Awaited<ReturnType<typeof seedVenues>>
) {
  // --- time_range: user chooses a start time + duration within bounds ---

  await prisma.resource.create({
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

  await prisma.resource.create({
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

  await prisma.resource.create({
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

  await prisma.resource.create({
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

  // --- date_range: user chooses a start date + end date ---

  await prisma.resource.create({
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

  await prisma.resource.create({
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

  // --- fixed_session: user books into one specific scheduled occurrence ---

  await prisma.resource.create({
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

  await prisma.resource.create({
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

  await prisma.resource.create({
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

  await prisma.resource.create({
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
}

async function main() {
  console.log("Seeding database...");

  // Order reflects real foreign-key dependencies: Tags and Activities have
  // none, so they go first; linking them requires both to already exist;
  // Venues require Users; Resources require both Venues and Activities.
  const tags = await seedTags();
  const activities = await seedActivities();
  await linkActivityTags(activities, tags);

  const { alex, priya } = await seedUsers();
  const venues = await seedVenues(alex.id, priya.id);
  await seedResources(activities, venues);

  console.log("Seeding complete: 6 tags, 7 activities, 3 users, 4 venues, 10 resources.");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());