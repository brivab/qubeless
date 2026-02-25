# Standard Analyzer Contract

Analyzers (plugins) are executed in a Docker container. The worker provides a mounted workspace and expects standardized output files.

## Volume Mounting

- Project code: `/workspace` (mounted read/write, contains the checkout)
- Expected output directory: `/out`

## Required Files in `/out`

- `report.json`: normalized issues
- `measures.json`: aggregated metrics
- `run.log`: readable text logs (execution trace)

## `report.json` Format

```json
{
  "analyzer": { "name": "string", "version": "string" },
  "issues": [
    {
      "ruleKey": "string",
      "severity": "INFO|MINOR|MAJOR|CRITICAL|BLOCKER",
      "type": "BUG|CODE_SMELL|VULNERABILITY",
      "filePath": "string",
      "line": 123,
      "message": "string",
      "fingerprint": "string"
    }
  ]
}
```

- `fingerprint` must be stable to track an issue over time (deterministic hash).
- `line` can be omitted or `null` if not applicable.

## `measures.json` Format

```json
{
  "metrics": {
    "issues_total": 10,
    "issues_blocker": 0,
    "issues_critical": 1
  }
}
```

- `metrics` is a dictionary `string -> number`. Keys can be extended (e.g., `duplicated_lines`, `complexity`).

## TypeScript Validators and Types

In `packages/shared`:

- Exported types: `AnalyzerMetadata`, `AnalyzerIssue`, `AnalyzerReport`, `AnalyzerMeasures`, as well as the unions `AnalyzerIssueSeverity` and `AnalyzerIssueType`.
- Exported Zod schemas: `analyzerIssueSchema`, `analyzerReportSchema`, `analyzerMeasuresSchema` (`src/validators/analyzer.ts` folder).

Recommended usage in worker/core:

```ts
import { analyzerReportSchema } from '@qubeless/shared';
const parsed = analyzerReportSchema.parse(jsonPayload);
```

## Integration Summary

1. The worker launches the analyzer container by mounting:
   - the workspace on `/workspace`
   - an empty volume for output on `/out`
2. The analyzer writes `report.json`, `measures.json` and `run.log` to `/out`.
3. The core/worker reads these files, validates via Zod schemas, then ingests issues/metrics.
