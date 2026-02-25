-- CreateTable
CREATE TABLE "AnalysisMetric" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "branchId" TEXT,
    "metricKey" TEXT NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisMetric_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "AnalysisMetric_analysisId_idx" ON "AnalysisMetric"("analysisId");
CREATE INDEX "AnalysisMetric_projectId_metricKey_idx" ON "AnalysisMetric"("projectId", "metricKey");
CREATE INDEX "AnalysisMetric_branchId_metricKey_idx" ON "AnalysisMetric"("branchId", "metricKey");

-- Foreign Keys
ALTER TABLE "AnalysisMetric" ADD CONSTRAINT "AnalysisMetric_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalysisMetric" ADD CONSTRAINT "AnalysisMetric_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalysisMetric" ADD CONSTRAINT "AnalysisMetric_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
