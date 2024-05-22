/*
  Warnings:

  - You are about to drop the column `buttonLocation` on the `Game` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Game" DROP COLUMN "buttonLocation",
ADD COLUMN     "usedCards" TEXT[];
