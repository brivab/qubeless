-- CreateTable
CREATE TABLE "UserEmailPreferences" (
    "id" SERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "analysisFailed" BOOLEAN NOT NULL DEFAULT true,
    "qualityGateFailed" BOOLEAN NOT NULL DEFAULT true,
    "issueAssigned" BOOLEAN NOT NULL DEFAULT true,
    "weeklyDigest" BOOLEAN NOT NULL DEFAULT false,
    "emailAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserEmailPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserEmailPreferences_userId_key" ON "UserEmailPreferences"("userId");

-- CreateIndex
CREATE INDEX "UserEmailPreferences_userId_idx" ON "UserEmailPreferences"("userId");

-- AddForeignKey
ALTER TABLE "UserEmailPreferences" ADD CONSTRAINT "UserEmailPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
