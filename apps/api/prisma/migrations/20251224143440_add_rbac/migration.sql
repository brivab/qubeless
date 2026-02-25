-- Step 1: Create new ProjectRole enum
CREATE TYPE "ProjectRole" AS ENUM ('PROJECT_ADMIN', 'PROJECT_MAINTAINER', 'PROJECT_VIEWER');

-- Step 2: Create new UserRole_new enum with USER value
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'USER');

-- Step 3: Rename old column to keep data
ALTER TABLE "User" RENAME COLUMN "role" TO "role_old";

-- Step 4: Add new column with new enum type, default to USER
ALTER TABLE "User" ADD COLUMN "globalRole" "UserRole_new" NOT NULL DEFAULT 'USER';

-- Step 5: Copy data from old column, mapping ADMIN -> ADMIN (USER doesn't exist in old enum so all are ADMIN)
UPDATE "User" SET "globalRole" =
  CASE
    WHEN "role_old" = 'ADMIN' THEN 'ADMIN'::"UserRole_new"
    ELSE 'USER'::"UserRole_new"
  END;

-- Step 6: Drop old column
ALTER TABLE "User" DROP COLUMN "role_old";

-- Step 7: Drop old enum (safe because it's not used anymore)
DROP TYPE "UserRole";

-- Step 8: Rename new enum to UserRole
ALTER TYPE "UserRole_new" RENAME TO "UserRole";

-- Step 9: Create ProjectMembership table
CREATE TABLE "ProjectMembership" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMembership_pkey" PRIMARY KEY ("id")
);

-- Step 10: Create indexes
CREATE UNIQUE INDEX "ProjectMembership_userId_projectId_key" ON "ProjectMembership"("userId", "projectId");
CREATE INDEX "ProjectMembership_userId_idx" ON "ProjectMembership"("userId");
CREATE INDEX "ProjectMembership_projectId_idx" ON "ProjectMembership"("projectId");

-- Step 11: Add foreign keys
ALTER TABLE "ProjectMembership" ADD CONSTRAINT "ProjectMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMembership" ADD CONSTRAINT "ProjectMembership_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
