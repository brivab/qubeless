-- CreateTable
CREATE TABLE "ProjectLlmSettings" (
    "projectId" TEXT NOT NULL,
    "llmProviderId" TEXT,
    "overridesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectLlmSettings_pkey" PRIMARY KEY ("projectId")
);

-- CreateIndex
CREATE INDEX "ProjectLlmSettings_llmProviderId_idx" ON "ProjectLlmSettings"("llmProviderId");

-- AddForeignKey
ALTER TABLE "ProjectLlmSettings" ADD CONSTRAINT "ProjectLlmSettings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLlmSettings" ADD CONSTRAINT "ProjectLlmSettings_llmProviderId_fkey" FOREIGN KEY ("llmProviderId") REFERENCES "LlmProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
