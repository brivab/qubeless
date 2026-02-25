-- AlterEnum
ALTER TYPE "SsoProvider" ADD VALUE 'LDAP';

-- CreateTable
CREATE TABLE "LlmPromptTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "taskPrompt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LlmPromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LlmPromptTemplate_name_idx" ON "LlmPromptTemplate"("name");

-- CreateIndex
CREATE INDEX "LlmPromptTemplate_isActive_idx" ON "LlmPromptTemplate"("isActive");

-- CreateIndex
CREATE INDEX "LlmPromptTemplate_createdAt_idx" ON "LlmPromptTemplate"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LlmPromptTemplate_name_version_key" ON "LlmPromptTemplate"("name", "version");
