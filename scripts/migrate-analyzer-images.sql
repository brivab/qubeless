-- Migration script to update analyzer Docker image names from old to new convention
-- Old convention: <prefix>/<name>-analyzer:<tag> or <name>-analyzer:<tag>
-- New convention: <registry>/analyzer-<name>:<tag>

-- Afficher l'état actuel avant migration
SELECT
    key,
    "dockerImage" as "Current Image",
    CASE
        WHEN "dockerImage" LIKE '%/analyzer-%' THEN '✅ Already using new convention'
        WHEN "dockerImage" LIKE '%-analyzer:%' THEN '⚠️  Needs migration'
        ELSE '❓ Unknown format'
    END as "Status"
FROM "Analyzer"
ORDER BY key;

-- Migration des images vers la nouvelle convention
-- Ceci met à jour toutes les images vers qubeless/analyzer-<name>:latest
UPDATE "Analyzer"
SET "dockerImage" = 'qubeless/analyzer-' || key || ':latest'
WHERE "dockerImage" LIKE '%-analyzer:%'
  AND "dockerImage" NOT LIKE '%/analyzer-%';

-- Afficher l'état après migration
SELECT
    key,
    "dockerImage" as "New Image",
    updated_at as "Last Updated"
FROM "Analyzer"
ORDER BY key;

-- Statistiques de migration
SELECT
    COUNT(*) as "Total Analyzers",
    COUNT(CASE WHEN "dockerImage" LIKE '%/analyzer-%' THEN 1 END) as "Using New Convention",
    COUNT(CASE WHEN "dockerImage" LIKE '%-analyzer:%' AND "dockerImage" NOT LIKE '%/analyzer-%' THEN 1 END) as "Still Using Old Convention"
FROM "Analyzer";
