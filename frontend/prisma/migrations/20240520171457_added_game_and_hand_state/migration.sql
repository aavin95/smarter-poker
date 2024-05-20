-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "dealer" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "state" TEXT NOT NULL DEFAULT 'waiting';

-- AlterTable
ALTER TABLE "Hand" ADD COLUMN     "state" TEXT NOT NULL DEFAULT 'inProgress';
