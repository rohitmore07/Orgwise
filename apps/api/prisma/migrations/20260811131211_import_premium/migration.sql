-- AlterEnum
ALTER TYPE "ImportStatus" ADD VALUE 'rolled_back';

-- AlterTable
ALTER TABLE "ImportHistory" ADD COLUMN     "importedRecordIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "label" TEXT,
ADD COLUMN     "type" TEXT,
ADD COLUMN     "updatedCount" INTEGER NOT NULL DEFAULT 0;
