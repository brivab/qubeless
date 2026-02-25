-- CreateEnum
CREATE TYPE "CoverageFormat" AS ENUM ('LCOV', 'COBERTURA', 'JACOCO');

-- CreateTable
CREATE TABLE "CoverageReport" (
    "id" SERIAL NOT NULL,
    "analysisId" TEXT NOT NULL,
    "format" "CoverageFormat" NOT NULL,
    "totalLines" INTEGER NOT NULL,
    "coveredLines" INTEGER NOT NULL,
    "totalBranches" INTEGER NOT NULL,
    "coveredBranches" INTEGER NOT NULL,
    "coveragePercent" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoverageReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileCoverage" (
    "id" SERIAL NOT NULL,
    "coverageReportId" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "lines" INTEGER NOT NULL,
    "coveredLines" INTEGER NOT NULL,
    "branches" INTEGER NOT NULL,
    "coveredBranches" INTEGER NOT NULL,
    "lineHits" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoverageReport_analysisId_key" ON "CoverageReport"("analysisId");

-- CreateIndex
CREATE INDEX "CoverageReport_analysisId_idx" ON "CoverageReport"("analysisId");

-- CreateIndex
CREATE INDEX "FileCoverage_coverageReportId_idx" ON "FileCoverage"("coverageReportId");

-- CreateIndex
CREATE INDEX "FileCoverage_filePath_idx" ON "FileCoverage"("filePath");

-- AddForeignKey
ALTER TABLE "CoverageReport" ADD CONSTRAINT "CoverageReport_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileCoverage" ADD CONSTRAINT "FileCoverage_coverageReportId_fkey" FOREIGN KEY ("coverageReportId") REFERENCES "CoverageReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
