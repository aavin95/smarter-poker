/*
  Warnings:

  - You are about to drop the column `hostId` on the `Game` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Game" DROP CONSTRAINT "Game_hostId_fkey";

-- AlterTable
ALTER TABLE "Game" DROP COLUMN "hostId";
