-- CreateEnum
CREATE TYPE "SsoProvider" AS ENUM ('OIDC', 'SAML');

-- CreateTable
CREATE TABLE "SsoIdentity" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" "SsoProvider" NOT NULL,
    "subject" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsoIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SsoIdentity_provider_subject_key" ON "SsoIdentity"("provider", "subject");

-- CreateIndex
CREATE INDEX "SsoIdentity_email_idx" ON "SsoIdentity"("email");

-- CreateIndex
CREATE INDEX "SsoIdentity_userId_idx" ON "SsoIdentity"("userId");

-- AddForeignKey
ALTER TABLE "SsoIdentity" ADD CONSTRAINT "SsoIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
