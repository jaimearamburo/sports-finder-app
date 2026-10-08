-- CreateEnum
CREATE TYPE "override_kind" AS ENUM ('block', 'open');

-- AlterTable
ALTER TABLE "resources" ADD COLUMN     "hold_duration_minutes" INTEGER;

-- AlterTable
ALTER TABLE "venues" ADD COLUMN     "booking_window_days" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "hold_duration_minutes" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Australia/Sydney';

-- CreateTable
CREATE TABLE "availability_overrides" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT,
    "resource_id" TEXT,
    "kind" "override_kind" NOT NULL,
    "days_of_week" INTEGER[],
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "start_time" TEXT,
    "end_time" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_holds" (
    "id" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT,
    "guest_token" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_holds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "availability_overrides_venue_id_start_date_end_date_idx" ON "availability_overrides"("venue_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "availability_overrides_resource_id_start_date_end_date_idx" ON "availability_overrides"("resource_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "booking_holds_resource_id_starts_at_ends_at_idx" ON "booking_holds"("resource_id", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "booking_holds_expires_at_idx" ON "booking_holds"("expires_at");

-- AddForeignKey
ALTER TABLE "availability_overrides" ADD CONSTRAINT "availability_overrides_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_overrides" ADD CONSTRAINT "availability_overrides_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_holds" ADD CONSTRAINT "booking_holds_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_holds" ADD CONSTRAINT "booking_holds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
