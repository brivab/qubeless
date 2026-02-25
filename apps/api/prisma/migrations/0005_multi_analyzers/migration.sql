-- Add analyzerKey to issues and artifacts, with per-analyzer uniqueness
ALTER TABLE "Issue" ADD COLUMN "analyzerKey" TEXT NOT NULL DEFAULT 'legacy';
DROP INDEX IF EXISTS "Issue_analysisId_fingerprint_key";
CREATE UNIQUE INDEX "Issue_analysisId_analyzerKey_fingerprint_key" ON "Issue"("analysisId", "analyzerKey", "fingerprint");

ALTER TABLE "AnalysisArtifact" ADD COLUMN "analyzerKey" TEXT NOT NULL DEFAULT 'legacy';
DROP INDEX IF EXISTS "AnalysisArtifact_analysisId_kind_key";
CREATE UNIQUE INDEX "AnalysisArtifact_analysisId_analyzerKey_kind_key" ON "AnalysisArtifact"("analysisId", "analyzerKey", "kind");
