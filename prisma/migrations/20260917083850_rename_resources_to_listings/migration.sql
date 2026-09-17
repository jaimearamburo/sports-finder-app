/*
  Warnings:

  - You are about to drop the column `resource_id` on the `availability_overrides` table. All the data in the column will be lost.
  - You are about to drop the column `resource_id` on the `booking_holds` table. All the data in the column will be lost.
  - You are about to drop the column `resource_id` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the `resources` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `listing_id` to the `booking_holds` table without a default value. This is not possible if the table is not empty.
  - Added the required column `listing_id` to the `bookings` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "availability_overrides" DROP CONSTRAINT "availability_overrides_resource_id_fkey";

-- DropForeignKey
ALTER TABLE "booking_holds" DROP CONSTRAINT "booking_holds_resource_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_resource_id_fkey";

-- DropForeignKey
ALTER TABLE "resources" DROP CONSTRAINT "resources_activity_id_fkey";

-- DropForeignKey
ALTER TABLE "resources" DROP CONSTRAINT "resources_venue_id_fkey";

-- DropIndex
DROP INDEX "availability_overrides_resource_id_start_date_end_date_idx";

-- DropIndex
DROP INDEX "booking_holds_resource_id_starts_at_ends_at_idx";

-- DropIndex
DROP INDEX "bookings_resource_id_starts_at_ends_at_idx";

-- AlterTable
ALTER TABLE "availability_overrides" DROP COLUMN "resource_id",
ADD COLUMN     "listing_id" TEXT;

-- AlterTable
ALTER TABLE "booking_holds" DROP COLUMN "resource_id",
ADD COLUMN     "listing_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "bookings" DROP COLUMN "resource_id",
ADD COLUMN     "listing_id" TEXT NOT NULL;

-- DropTable
DROP TABLE "resources";

-- CreateTable
CREATE TABLE "listings" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "capacity" INTEGER DEFAULT 1,
    "price_per_unit" DECIMAL(10,2) NOT NULL,
    "operating_hours_start" TEXT,
    "operating_hours_end" TEXT,
    "min_duration_minutes" INTEGER,
    "max_duration_minutes" INTEGER,
    "increment_minutes" INTEGER,
    "min_duration_days" INTEGER,
    "max_duration_days" INTEGER,
    "recurrence_day_of_week" INTEGER,
    "recurrence_start_time" TEXT,
    "session_duration_minutes" INTEGER,
    "hold_duration_minutes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listings_venue_id_idx" ON "listings"("venue_id");

-- CreateIndex
CREATE INDEX "listings_activity_id_idx" ON "listings"("activity_id");

-- CreateIndex
CREATE INDEX "availability_overrides_listing_id_start_date_end_date_idx" ON "availability_overrides"("listing_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "booking_holds_listing_id_starts_at_ends_at_idx" ON "booking_holds"("listing_id", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "bookings_listing_id_starts_at_ends_at_idx" ON "bookings"("listing_id", "starts_at", "ends_at");

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_overrides" ADD CONSTRAINT "availability_overrides_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_holds" ADD CONSTRAINT "booking_holds_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
