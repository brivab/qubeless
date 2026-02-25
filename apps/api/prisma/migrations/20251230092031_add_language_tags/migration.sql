-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'USER_CREATE';
ALTER TYPE "AuditAction" ADD VALUE 'ANALYSIS_CREATE';
ALTER TYPE "AuditAction" ADD VALUE 'ISSUE_RESOLVE';

-- DropForeignKey
ALTER TABLE "AnalysisMetric" DROP CONSTRAINT "AnalysisMetric_branchId_fkey";

-- DropIndex
DROP INDEX "AnalysisArtifact_analysisId_kind_idx";

-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "language" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "languages" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "SsoIdentity" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "id" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "AnalysisArtifact_analysisId_analyzerKey_kind_idx" ON "AnalysisArtifact"("analysisId", "analyzerKey", "kind");

-- CreateIndex
CREATE INDEX "Issue_language_idx" ON "Issue"("language");

-- AddForeignKey
ALTER TABLE "AnalysisMetric" ADD CONSTRAINT "AnalysisMetric_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
