-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN     "debtRatio" DECIMAL(10,2),
ADD COLUMN     "maintainabilityRating" TEXT,
ADD COLUMN     "remediationCost" INTEGER;
