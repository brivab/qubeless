-- CreateTable
CREATE TABLE "LlmProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "model" TEXT,
    "headersJson" JSONB,
    "tokenEncrypted" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LlmProvider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LlmProvider_name_key" ON "LlmProvider"("name");

-- CreateIndex
CREATE INDEX "LlmProvider_providerType_idx" ON "LlmProvider"("providerType");

-- CreateIndex
CREATE INDEX "LlmProvider_isDefault_idx" ON "LlmProvider"("isDefault");
