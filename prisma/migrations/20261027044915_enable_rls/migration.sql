-- Enable row-level security on every table, with no policies.
--
-- Supabase exposes the public schema through its own REST/GraphQL API,
-- authenticated with the project's anon/authenticated keys. This app never
-- uses that API - all data access goes through Prisma - so the only thing
-- standing between that API and these tables (users.password_hash,
-- bookings, sessions, ...) was that those roles happen to have no table
-- grants. RLS with no policies is a second, independent wall: even if a
-- grant were ever added (e.g. by a Supabase dashboard action), those roles
-- would still see zero rows.
--
-- The app is unaffected: Prisma connects as `postgres`, which owns every
-- table and has BYPASSRLS. Checked before writing this migration.
--
-- New tables added by future migrations need the same line.

-- Prisma's own bookkeeping table doesn't exist in the throwaway "shadow"
-- database `prisma migrate dev` replays migrations into, so it's enabled
-- only where it exists rather than failing the replay.
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activity_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "availability_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "booking_holds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "countries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "listings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "venues" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verification_tokens" ENABLE ROW LEVEL SECURITY;
