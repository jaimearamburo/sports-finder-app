// Seed script skeleton — structure only for now. Creates one
// minimal example row per table to prove the plumbing works end to end.
// Phase 3 will replace these placeholders with a
// realistic, varied dataset (multiple venues, sports, resources, etc.).
//
// Order matters: each function depends on records the earlier ones create —
// Venue needs a User owner to already exist, Resource needs a Venue and an
// Activity to already exist.

import "dotenv/config";
import { prisma } from "../lib/prisma";

async function seedActivities() {
  // Activity has a unique "name", so upsert is safe to re-run without
  // creating duplicates.
  const tennis = await prisma.activity.upsert({
    where: { name: "Tennis" },
    update: {},
    create: {
      name: "Tennis",
      bookingMechanic: "time_range",
    },
  });

  // TODO: add the rest — Padel, Indoor Football, Camping, Gym Class...

  return { tennis };
}

async function seedUsers() {
  // User has a unique "email", same reasoning as above.
  const owner = await prisma.user.upsert({
    where: { email: "owner@example.com" },
    update: {},
    create: {
      name: "Example Venue Owner",
      email: "owner@example.com",
      role: "venue_owner",
    },
  });

  // TODO: add a regular "user" role account too, for testing bookings

  return { owner };
}

async function seedVenues(ownerId: string) {
  // Venue has no unique field besides its id, so re-running this without
  // resetting the database will create a duplicate venue each time — that's
  // fine for now (use `prisma migrate reset` to start clean if needed).
  const venue = await prisma.venue.create({
    data: {
      ownerId,
      name: "Example Tennis Club",
      address: "123 Example Street",
      city: "Sydney",
    },
  });

  // TODO: add more venues, across different cities and activities

  return { venue };
}

//
async function seedResources(venueId: string, activityId: string) {
  const resource = await prisma.resource.create({
    data: {
      venueId,
      activityId,
      name: "Court 1",
      capacity: 1,
      pricePerUnit: 20,
      operatingHoursStart: "09:00",
      operatingHoursEnd: "21:00",
      minDurationMinutes: 30,
      maxDurationMinutes: 120,
      incrementMinutes: 30,
    },
  });

  // TODO: add more resources per venue (Court 2, Court 3, ...)

  return { resource };
}

async function main() {
  console.log("Seeding database...");

  const { tennis } = await seedActivities();
  const { owner } = await seedUsers();
  const { venue } = await seedVenues(owner.id);
  await seedResources(venue.id, tennis.id);

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());