/*
  Warnings:

  - Added the required column `order_id` to the `booking_holds` table without a default value. This is not possible if the table is not empty.
  - Added the required column `order_id` to the `bookings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "booking_holds" ADD COLUMN     "order_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "order_id" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "booking_holds_order_id_idx" ON "booking_holds"("order_id");

-- CreateIndex
CREATE INDEX "booking_holds_user_id_expires_at_idx" ON "booking_holds"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "bookings_order_id_idx" ON "bookings"("order_id");
