-- CreateTable
CREATE TABLE "Rule" (
    "key" TEXT NOT NULL,
    "analyzerKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "defaultSeverity" "IssueSeverity" NOT NULL,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "RuleProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleProfileRule" (
    "ruleProfileId" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleProfileRule_pkey" PRIMARY KEY ("ruleProfileId","ruleKey")
);

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "activeRuleProfileId" TEXT;

-- Indexes
CREATE INDEX "Rule_analyzerKey_idx" ON "Rule"("analyzerKey");
CREATE INDEX "RuleProfile_projectId_idx" ON "RuleProfile"("projectId");
CREATE UNIQUE INDEX "RuleProfile_projectId_name_key" ON "RuleProfile"("projectId", "name");
CREATE INDEX "RuleProfileRule_ruleKey_idx" ON "RuleProfileRule"("ruleKey");
CREATE INDEX "Project_activeRuleProfileId_idx" ON "Project"("activeRuleProfileId");

-- Foreign Keys
ALTER TABLE "RuleProfile" ADD CONSTRAINT "RuleProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RuleProfileRule" ADD CONSTRAINT "RuleProfileRule_ruleProfileId_fkey" FOREIGN KEY ("ruleProfileId") REFERENCES "RuleProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RuleProfileRule" ADD CONSTRAINT "RuleProfileRule_ruleKey_fkey" FOREIGN KEY ("ruleKey") REFERENCES "Rule"("key") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_activeRuleProfileId_fkey" FOREIGN KEY ("activeRuleProfileId") REFERENCES "RuleProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
