-- Add user-scoped VCS tokens and track LLM run requester

-- Allow multiple tokens per provider by user (drop old unique index)
ALTER TABLE "VcsToken" DROP CONSTRAINT IF EXISTS "VcsToken_provider_key";
DROP INDEX IF EXISTS "VcsToken_provider_key";

-- Add userId to VcsToken
ALTER TABLE "VcsToken" ADD COLUMN "userId" UUID;
ALTER TABLE "VcsToken"
  ADD CONSTRAINT "VcsToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "VcsToken_userId_idx" ON "VcsToken"("userId");
CREATE UNIQUE INDEX "VcsToken_provider_userId_key" ON "VcsToken"("provider", "userId");

-- Track which user requested the LLM run
ALTER TABLE "LlmRun" ADD COLUMN "requestedByUserId" UUID;
ALTER TABLE "LlmRun"
  ADD CONSTRAINT "LlmRun_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "LlmRun_requestedByUserId_idx" ON "LlmRun"("requestedByUserId");
