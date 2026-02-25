-- AlterTable
ALTER TABLE IF EXISTS "LlmRun" ADD COLUMN IF NOT EXISTS "pullRequestId" TEXT;

-- AlterTable
ALTER TABLE IF EXISTS "PullRequest" ADD COLUMN IF NOT EXISTS "url" TEXT;

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "LlmRun_pullRequestId_idx" ON "LlmRun"("pullRequestId");
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "LlmRun"
    ADD CONSTRAINT "LlmRun_pullRequestId_fkey"
    FOREIGN KEY ("pullRequestId") REFERENCES "PullRequest"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
  WHEN undefined_table THEN
    NULL;
END $$;
