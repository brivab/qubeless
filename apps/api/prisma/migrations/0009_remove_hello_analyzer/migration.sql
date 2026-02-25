-- Purge legacy hello analyzers that may still exist in the DB
DELETE FROM "ProjectAnalyzer"
WHERE "analyzerId" IN (
  SELECT id FROM "Analyzer" WHERE key IN ('hello-analyzer', 'hello-scanner')
);

DELETE FROM "Analyzer"
WHERE key IN ('hello-analyzer', 'hello-scanner');
