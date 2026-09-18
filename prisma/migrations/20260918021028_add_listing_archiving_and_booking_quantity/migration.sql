-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_listing_id_fkey";

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "archived_at" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
