-- Add isNew flag to mark freshly introduced issues
ALTER TABLE "Issue" ADD COLUMN "isNew" BOOLEAN NOT NULL DEFAULT false;
