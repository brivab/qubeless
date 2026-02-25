-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN     "duplicationBlocks" INTEGER,
ADD COLUMN     "duplicationPercent" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "DuplicationBlock" (
    "id" SERIAL NOT NULL,
    "analysisId" TEXT NOT NULL,
    "file1Path" TEXT NOT NULL,
    "file1StartLine" INTEGER NOT NULL,
    "file1EndLine" INTEGER NOT NULL,
    "file2Path" TEXT NOT NULL,
    "file2StartLine" INTEGER NOT NULL,
    "file2EndLine" INTEGER NOT NULL,
    "lines" INTEGER NOT NULL,
    "tokens" INTEGER NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuplicationBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DuplicationBlock_analysisId_idx" ON "DuplicationBlock"("analysisId");

-- CreateIndex
CREATE INDEX "DuplicationBlock_file1Path_idx" ON "DuplicationBlock"("file1Path");

-- CreateIndex
CREATE INDEX "DuplicationBlock_file2Path_idx" ON "DuplicationBlock"("file2Path");

-- AddForeignKey
ALTER TABLE "DuplicationBlock" ADD CONSTRAINT "DuplicationBlock_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
