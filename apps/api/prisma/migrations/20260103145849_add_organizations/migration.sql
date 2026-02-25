/*
  Warnings:

  - Added the required column `organizationId` to the `Project` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'ORGANIZATION_CREATE';
ALTER TYPE "AuditAction" ADD VALUE 'ORGANIZATION_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE 'ORGANIZATION_DELETE';
ALTER TYPE "AuditAction" ADD VALUE 'ORGANIZATION_MEMBER_ADD';
ALTER TYPE "AuditAction" ADD VALUE 'ORGANIZATION_MEMBER_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE 'ORGANIZATION_MEMBER_REMOVE';

-- AlterTable
ALTER TABLE "Analyzer" ADD COLUMN     "organizationId" TEXT;

-- AlterTable (add as nullable first for data migration)
ALTER TABLE "Project" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "QualityGate" ADD COLUMN     "organizationId" TEXT;

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_slug_idx" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "OrganizationMembership_userId_idx" ON "OrganizationMembership"("userId");

-- CreateIndex
CREATE INDEX "OrganizationMembership_organizationId_idx" ON "OrganizationMembership"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_organizationId_userId_key" ON "OrganizationMembership"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "Analyzer_organizationId_idx" ON "Analyzer"("organizationId");

-- CreateIndex
CREATE INDEX "Project_organizationId_idx" ON "Project"("organizationId");

-- CreateIndex
CREATE INDEX "QualityGate_organizationId_idx" ON "QualityGate"("organizationId");

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analyzer" ADD CONSTRAINT "Analyzer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityGate" ADD CONSTRAINT "QualityGate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data Migration: Create default organization
INSERT INTO "Organization" ("id", "name", "slug", "description", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    'Default Organization',
    'default',
    'Default organization created during migration',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Organization" WHERE "slug" = 'default');

-- Data Migration: Migrate all existing projects to default organization
UPDATE "Project"
SET "organizationId" = (SELECT "id" FROM "Organization" WHERE "slug" = 'default')
WHERE "organizationId" IS NULL;

-- Data Migration: Make all ADMIN users OWNER of default organization
INSERT INTO "OrganizationMembership" ("id", "organizationId", "userId", "role", "createdAt")
SELECT
    gen_random_uuid()::text,
    (SELECT "id" FROM "Organization" WHERE "slug" = 'default'),
    "id",
    'OWNER'::"OrgRole",
    CURRENT_TIMESTAMP
FROM "User"
WHERE "globalRole" = 'ADMIN'
ON CONFLICT ("organizationId", "userId") DO NOTHING;

-- Make organizationId NOT NULL now that data is migrated
ALTER TABLE "Project" ALTER COLUMN "organizationId" SET NOT NULL;

-- AddForeignKey (add this after making the column NOT NULL)
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
