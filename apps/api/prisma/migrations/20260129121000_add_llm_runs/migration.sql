-- CreateEnum
CREATE TYPE "LlmRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "LlmRun" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "providerId" TEXT,
    "status" "LlmRunStatus" NOT NULL DEFAULT 'QUEUED',
    "promptVersion" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "cost" DECIMAL(10,4),
    "outputPatch" TEXT,
    "outputSummary" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LlmRun_issueId_idx" ON "LlmRun"("issueId");

-- CreateIndex
CREATE INDEX "LlmRun_projectId_idx" ON "LlmRun"("projectId");

-- CreateIndex
CREATE INDEX "LlmRun_providerId_idx" ON "LlmRun"("providerId");

-- CreateIndex
CREATE INDEX "LlmRun_status_idx" ON "LlmRun"("status");

-- CreateIndex
CREATE INDEX "LlmRun_createdAt_idx" ON "LlmRun"("createdAt");

-- AddForeignKey
ALTER TABLE "LlmRun" ADD CONSTRAINT "LlmRun_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlmRun" ADD CONSTRAINT "LlmRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlmRun" ADD CONSTRAINT "LlmRun_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "LlmProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
