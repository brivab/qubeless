-- CreateTable
CREATE TABLE "Analyzer" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dockerImage" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Analyzer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAnalyzer" (
    "projectId" TEXT NOT NULL,
    "analyzerId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "configJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectAnalyzer_pkey" PRIMARY KEY ("projectId", "analyzerId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Analyzer_key_key" ON "Analyzer"("key");
CREATE INDEX "Analyzer_enabled_idx" ON "Analyzer"("enabled");
CREATE INDEX "ProjectAnalyzer_analyzerId_idx" ON "ProjectAnalyzer"("analyzerId");

-- AddForeignKey
ALTER TABLE "ProjectAnalyzer" ADD CONSTRAINT "ProjectAnalyzer_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectAnalyzer" ADD CONSTRAINT "ProjectAnalyzer_analyzerId_fkey" FOREIGN KEY ("analyzerId") REFERENCES "Analyzer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
