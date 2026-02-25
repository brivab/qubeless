-- CreateEnum
CREATE TYPE "ArtifactKind" AS ENUM ('REPORT', 'MEASURES', 'LOG', 'SOURCE_ZIP');

-- CreateTable
CREATE TABLE "AnalysisArtifact" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "kind" "ArtifactKind" NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalysisArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisArtifact_analysisId_kind_key" ON "AnalysisArtifact"("analysisId", "kind");
CREATE INDEX "AnalysisArtifact_analysisId_kind_idx" ON "AnalysisArtifact"("analysisId", "kind");

-- AddForeignKey
ALTER TABLE "AnalysisArtifact" ADD CONSTRAINT "AnalysisArtifact_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
