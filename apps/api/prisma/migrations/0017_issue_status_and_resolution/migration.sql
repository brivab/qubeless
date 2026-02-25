-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'FALSE_POSITIVE', 'ACCEPTED_RISK', 'RESOLVED');

-- AlterTable
ALTER TABLE "Issue" ADD COLUMN "status" "IssueStatus" NOT NULL DEFAULT 'OPEN';

-- CreateTable
CREATE TABLE "IssueResolution" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "status" "IssueStatus" NOT NULL,
    "comment" TEXT,
    "author" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueResolution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Issue_status_idx" ON "Issue"("status");

-- CreateIndex
CREATE INDEX "IssueResolution_issueId_idx" ON "IssueResolution"("issueId");

-- CreateIndex
CREATE INDEX "IssueResolution_createdAt_idx" ON "IssueResolution"("createdAt");

-- AddForeignKey
ALTER TABLE "IssueResolution" ADD CONSTRAINT "IssueResolution_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
