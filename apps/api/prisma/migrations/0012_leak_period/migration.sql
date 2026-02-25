-- CreateEnum
CREATE TYPE "LeakPeriodType" AS ENUM ('LAST_ANALYSIS', 'DATE', 'BASE_BRANCH');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "leakPeriodType" "LeakPeriodType" NOT NULL DEFAULT 'LAST_ANALYSIS',
ADD COLUMN     "leakPeriodValue" TEXT;
