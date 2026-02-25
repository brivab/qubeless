-- Add scope to quality gate conditions (ALL | NEW)
CREATE TYPE "QualityGateScope" AS ENUM ('ALL', 'NEW');

ALTER TABLE "QualityGateCondition"
  ADD COLUMN "scope" "QualityGateScope" NOT NULL DEFAULT 'ALL';
