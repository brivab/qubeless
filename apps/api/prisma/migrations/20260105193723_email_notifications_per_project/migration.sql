/*
  Warnings:

  - You are about to drop the `UserEmailPreferences` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "UserEmailPreferences" DROP CONSTRAINT "UserEmailPreferences_userId_fkey";

-- AlterTable
ALTER TABLE "ProjectMembership" ADD COLUMN     "emailAddress" TEXT,
ADD COLUMN     "emailNotifyAnalysisFailed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailNotifyQualityGateFailed" BOOLEAN NOT NULL DEFAULT true;

-- DropTable
DROP TABLE "UserEmailPreferences";
