-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "baselineAnalysisId" TEXT;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_baselineAnalysisId_fkey" FOREIGN KEY ("baselineAnalysisId") REFERENCES "Analysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Index
CREATE INDEX "Issue_baselineAnalysisId_idx" ON "Issue"("baselineAnalysisId");
