-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "IssueSeverity" AS ENUM ('INFO', 'MINOR', 'MAJOR', 'CRITICAL', 'BLOCKER');

-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('BUG', 'CODE_SMELL', 'VULNERABILITY');

-- CreateEnum
CREATE TYPE "QualityGateOperator" AS ENUM ('GT', 'LT', 'EQ');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "severity" "IssueSeverity" NOT NULL,
    "type" "IssueType" NOT NULL,
    "filePath" TEXT NOT NULL,
    "line" INTEGER,
    "message" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityGate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualityGate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityGateCondition" (
    "id" TEXT NOT NULL,
    "qualityGateId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "operator" "QualityGateOperator" NOT NULL,
    "threshold" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "QualityGateCondition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_key_key" ON "Project"("key");

-- CreateIndex
CREATE INDEX "Branch_projectId_isDefault_idx" ON "Branch"("projectId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_projectId_name_key" ON "Branch"("projectId", "name");

-- CreateIndex
CREATE INDEX "Analysis_projectId_idx" ON "Analysis"("projectId");

-- CreateIndex
CREATE INDEX "Analysis_branchId_idx" ON "Analysis"("branchId");

-- CreateIndex
CREATE INDEX "Analysis_projectId_branchId_idx" ON "Analysis"("projectId", "branchId");

-- CreateIndex
CREATE INDEX "Analysis_status_idx" ON "Analysis"("status");

-- CreateIndex
CREATE INDEX "Issue_fingerprint_idx" ON "Issue"("fingerprint");

-- CreateIndex
CREATE INDEX "Issue_analysisId_idx" ON "Issue"("analysisId");

-- CreateIndex
CREATE UNIQUE INDEX "Issue_analysisId_fingerprint_key" ON "Issue"("analysisId", "fingerprint");

-- CreateIndex
CREATE INDEX "QualityGate_projectId_idx" ON "QualityGate"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "QualityGate_projectId_name_key" ON "QualityGate"("projectId", "name");

-- CreateIndex
CREATE INDEX "QualityGateCondition_qualityGateId_idx" ON "QualityGateCondition"("qualityGateId");

-- CreateIndex
CREATE INDEX "QualityGateCondition_metric_idx" ON "QualityGateCondition"("metric");

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityGate" ADD CONSTRAINT "QualityGate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityGateCondition" ADD CONSTRAINT "QualityGateCondition_qualityGateId_fkey" FOREIGN KEY ("qualityGateId") REFERENCES "QualityGate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

