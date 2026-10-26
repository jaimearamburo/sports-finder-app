/*
  Warnings:

  - Added the required column `attendee_email` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `attendee_name` to the `bookings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "booking_holds" ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "attendee_email" TEXT NOT NULL,
ADD COLUMN     "attendee_name" TEXT NOT NULL,
ADD COLUMN     "attendee_phone" TEXT;
