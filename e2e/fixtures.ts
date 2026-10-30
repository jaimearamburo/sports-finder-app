import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { query, utc } from "./db";

// The accounts and records the end-to-end tests run against. They're
// created fresh before every run and deleted afterwards (global-setup.ts,
// global-teardown.ts), so the tests never depend on seed data or on anyone
// knowing a seeded account's password. Everything is marked with the "e2e-"
// email prefix or the "E2E " name prefix, so it's easy to find and can't be
// confused with real data.

export const ROLES = ["ownerA", "ownerB", "user", "admin"] as const;
export type TestRole = (typeof ROLES)[number];

export const ACCOUNTS: Record<TestRole, { email: string; name: string; role: "venue_owner" | "user" | "admin" }> = {
  ownerA: { email: "e2e-owner-a@example.com", name: "E2E Owner A", role: "venue_owner" },
  ownerB: { email: "e2e-owner-b@example.com", name: "E2E Owner B", role: "venue_owner" },
  user: { email: "e2e-user@example.com", name: "E2E User", role: "user" },
  admin: { email: "e2e-admin@example.com", name: "E2E Admin", role: "admin" },
};

// What the tests need to know about the created records, passed from global
// setup to the test workers as JSON in an environment variable.
export type FixtureIds = {
  venueA: string;
  venueB: string;
  listingA: string;
  listingB: string;
  attendeeA: string;
  attendeeB: string;
};

export const authFile = (role: TestRole) => `e2e/.auth/${role}.json`;

export function fixtureIds(): FixtureIds {
  const raw = process.env.E2E_FIXTURES;
  if (!raw) throw new Error("E2E_FIXTURES is missing - run the tests with `pnpm test:e2e` so global setup runs first.");
  return JSON.parse(raw) as FixtureIds;
}

export function testPassword(): string {
  const password = process.env.E2E_PASSWORD;
  if (!password) throw new Error("E2E_PASSWORD is missing - run the tests with `pnpm test:e2e` so global setup runs first.");
  return password;
}

// Removes everything a previous run may have left behind, in the order the
// database's foreign keys allow: bookings and holds before listings
// (bookings.listing_id is ON DELETE RESTRICT), venues (which take their
// listings with them) before their owners.
export async function removeTestData() {
  const testVenues = "select v.id from venues v join users u on u.id = v.owner_id where u.email like 'e2e-%'";
  const testListings = `select id from listings where venue_id in (${testVenues})`;
  await query(`delete from bookings where listing_id in (${testListings})`);
  await query(`delete from booking_holds where listing_id in (${testListings})`);
  await query(`delete from venues where id in (${testVenues})`);
  await query("delete from users where email like 'e2e-%'");
}

const NOW = "(now() at time zone 'utc')";

// Creates the test accounts (all with one random password, new each run)
// and two venues with one court each - venue A owned by owner A, venue B by
// owner B - with one upcoming booking at each, so the tests can check that
// each owner sees only their own.
export async function createTestData(): Promise<{ password: string; ids: FixtureIds }> {
  await removeTestData();
  const password = randomBytes(18).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 10);

  const users = {} as Record<TestRole, string>;
  for (const role of ROLES) {
    const account = ACCOUNTS[role];
    users[role] = `e2e-${randomUUID()}`;
    await query(
      `insert into users (id, name, email, role, password_hash, updated_at) values ($1, $2, $3, $4, $5, ${NOW})`,
      [users[role], account.name, account.email, account.role, passwordHash]
    );
  }

  // Platform reference data the seed always provides: any city, and a
  // "book a time" activity for the courts.
  const [city] = await query<{ id: string }>("select id from cities order by name limit 1");
  const [activity] = await query<{ id: string }>(
    "select id from activities where booking_mechanic = 'time_range' order by name limit 1"
  );
  if (!city || !activity) throw new Error("The database needs its seed data (cities, activities) for the e2e tests.");

  async function venueWithCourt(owner: TestRole, label: "A" | "B") {
    const venue = `e2e-${randomUUID()}`;
    const listing = `e2e-${randomUUID()}`;
    await query(
      `insert into venues (id, name, address, city_id, owner_id, updated_at) values ($1, $2, $3, $4, $5, ${NOW})`,
      [venue, `E2E Venue ${label}`, `${label} Test Street`, city.id, users[owner]]
    );
    await query(
      `insert into listings (id, name, venue_id, activity_id, price_per_unit, capacity, max_bookings_per_transaction,
         operating_hours_start, operating_hours_end, increment_minutes, min_duration_minutes, max_duration_minutes, updated_at)
       values ($1, $2, $3, $4, 20, 1, 1, '08:00', '20:00', 30, 60, 120, ${NOW})`,
      [listing, `E2E Court ${label}`, venue, activity.id]
    );
    // A confirmed booking a few days out, so it shows as upcoming.
    const startsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    startsAt.setUTCMinutes(0, 0, 0);
    const attendee = `E2E Attendee ${label}`;
    await query(
      `insert into bookings (id, order_id, listing_id, user_id, starts_at, ends_at, status, amount_paid, attendee_name, attendee_email, updated_at)
       values ($1, $2, $3, $4, $5, $6, 'confirmed', 20, $7, $8, ${NOW})`,
      [
        `e2e-${randomUUID()}`,
        randomUUID(),
        listing,
        users.user,
        utc(startsAt),
        utc(new Date(startsAt.getTime() + 60 * 60 * 1000)),
        attendee,
        `e2e-attendee-${label.toLowerCase()}@example.com`,
      ]
    );
    return { venue, listing, attendee };
  }

  const a = await venueWithCourt("ownerA", "A");
  const b = await venueWithCourt("ownerB", "B");
  return {
    password,
    ids: { venueA: a.venue, venueB: b.venue, listingA: a.listing, listingB: b.listing, attendeeA: a.attendee, attendeeB: b.attendee },
  };
}
