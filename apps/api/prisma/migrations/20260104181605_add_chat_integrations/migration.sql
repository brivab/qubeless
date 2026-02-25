-- CreateTable
CREATE TABLE "ChatIntegration" (
    "id" SERIAL NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "channel" TEXT,
    "events" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatIntegration_projectId_idx" ON "ChatIntegration"("projectId");

-- CreateIndex
CREATE INDEX "ChatIntegration_enabled_idx" ON "ChatIntegration"("enabled");

-- AddForeignKey
ALTER TABLE "ChatIntegration" ADD CONSTRAINT "ChatIntegration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
