-- Add optional baseUrl for VCS tokens
ALTER TABLE "VcsToken" ADD COLUMN "baseUrl" TEXT;
