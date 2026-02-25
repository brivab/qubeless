-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN     "baselineAnalysisId" TEXT;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_baselineAnalysisId_fkey" FOREIGN KEY ("baselineAnalysisId") REFERENCES "Analysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Index
CREATE INDEX "Analysis_baselineAnalysisId_idx" ON "Analysis"("baselineAnalysisId");
