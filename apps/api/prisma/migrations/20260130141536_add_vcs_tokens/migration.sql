-- CreateTable
CREATE TABLE "VcsToken" (
    "id" TEXT NOT NULL,
    "provider" "PullRequestProvider" NOT NULL,
    "tokenEncrypted" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "VcsToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VcsToken_provider_key" ON "VcsToken"("provider");
