/*
  Warnings:

  - Made the column `country_id` on table `cities` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "cities" ALTER COLUMN "country_id" SET NOT NULL;
