-- CreateEnum
CREATE TYPE "PullRequestProvider" AS ENUM ('GITHUB', 'GITLAB');

-- CreateTable
CREATE TABLE "PullRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" "PullRequestProvider" NOT NULL,
    "repo" TEXT NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "sourceBranch" TEXT NOT NULL,
    "targetBranch" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PullRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PullRequest_projectId_provider_repo_prNumber_key" ON "PullRequest"("projectId", "provider", "repo", "prNumber");
CREATE INDEX "PullRequest_projectId_idx" ON "PullRequest"("projectId");

-- AddForeignKey
ALTER TABLE "PullRequest" ADD CONSTRAINT "PullRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable Analysis: branchId nullable + pullRequestId
ALTER TABLE "Analysis" ALTER COLUMN "branchId" DROP NOT NULL;
ALTER TABLE "Analysis" ADD COLUMN "pullRequestId" TEXT;

-- AddForeignKey for pullRequestId
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_pullRequestId_fkey" FOREIGN KEY ("pullRequestId") REFERENCES "PullRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Index for pullRequestId
CREATE INDEX "Analysis_pullRequestId_idx" ON "Analysis"("pullRequestId");

-- Enforce xor between branch and pullRequest (exactly one)
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_branch_or_pr_chk" CHECK (
  (CASE WHEN "branchId" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "pullRequestId" IS NOT NULL THEN 1 ELSE 0 END) = 1
);
