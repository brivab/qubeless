# Code Duplication Detection

## Overview

The code duplication detection feature uses [jscpd](https://github.com/kucherenko/jscpd) to identify duplicate code blocks across your codebase. This helps reduce technical debt and improve code maintainability.

## Features

- **Multi-language support**: Detects duplications in 150+ programming languages
- **Configurable thresholds**: Customize minimum lines and tokens for detection
- **Detailed reporting**: View exact file locations and line numbers of duplicates
- **Quality gate integration**: Enforce duplication limits with automatic quality gates

## Configuration

### Analyzer Settings

The jscpd analyzer supports the following environment variables:

- `JSCPD_MIN_LINES`: Minimum number of lines to consider as duplication (default: 5)
- `JSCPD_MIN_TOKENS`: Minimum number of tokens to consider as duplication (default: 50)

### Quality Gate Metrics

The following metrics are available for quality gate conditions:

| Metric | Description | Recommended Threshold |
|--------|-------------|----------------------|
| `duplication_percent` | Percentage of duplicated code | < 3.0% (SonarQube standard) |
| `duplication_blocks` | Number of duplicate code blocks | Project-specific |
| `duplicated_lines` | Total lines of duplicated code | Project-specific |

## Setting Up Quality Gates

### Using the API

To add a duplication quality gate condition:

```bash
# Create or update quality gate
POST /api/projects/{projectKey}/quality-gates
{
  "name": "Default Quality Gate"
}

# Add duplication condition
POST /api/quality-gates/{gateId}/conditions
{
  "metric": "duplication_percent",
  "operator": "LT",
  "threshold": 3.0,
  "scope": "ALL"
}
```

### Example Quality Gate Configuration

```json
{
  "name": "Production Quality Gate",
  "conditions": [
    {
      "metric": "duplication_percent",
      "operator": "LT",
      "threshold": 3.0,
      "scope": "ALL"
    },
    {
      "metric": "issues_total",
      "operator": "LT",
      "threshold": 100,
      "scope": "ALL"
    }
  ]
}
```

## Database Schema

### DuplicationBlock Model

```prisma
model DuplicationBlock {
  id             Int      @id @default(autoincrement())
  analysisId     String
  analysis       Analysis @relation(fields: [analysisId], references: [id], onDelete: Cascade)
  file1Path      String
  file1StartLine Int
  file1EndLine   Int
  file2Path      String
  file2StartLine Int
  file2EndLine   Int
  lines          Int
  tokens         Int
  fingerprint    String
  createdAt      DateTime @default(now())

  @@index([analysisId])
  @@index([file1Path])
  @@index([file2Path])
}
```

### Analysis Model Additions

```prisma
model Analysis {
  // ... existing fields
  duplicationPercent    Decimal? @db.Decimal(10, 2)
  duplicationBlocks     Int?
  duplicationBlocksData DuplicationBlock[]
}
```

## API Endpoints

### Get Duplication Statistics

```
GET /api/analyses/:id/duplication
```

**Response:**
```json
{
  "duplicationPercent": 39.39,
  "duplicationBlocks": 28,
  "duplicatedLines": 154,
  "totalSources": 6,
  "totalClones": 28
}
```

### Get Duplication Blocks

```
GET /api/analyses/:id/duplication/blocks
```

**Response:**
```json
[
  {
    "id": 1,
    "analysisId": "abc123",
    "file1Path": "src/file1.js",
    "file1StartLine": 10,
    "file1EndLine": 25,
    "file2Path": "src/file2.js",
    "file2StartLine": 45,
    "file2EndLine": 60,
    "lines": 15,
    "tokens": 151,
    "fingerprint": "sha256hash...",
    "createdAt": "2024-01-15T10:30:00Z"
  }
]
```

## UI Components

### DuplicationWidget

Dashboard widget showing:
- Duplication percentage with color-coded indicator
- Number of duplicated lines
- Number of duplicate blocks
- Quality gate status

### DuplicationDetailView

Detailed view showing:
- List of all duplicate blocks sorted by size
- File locations with line numbers
- Expandable blocks with recommendations
- Summary statistics

## Best Practices

1. **Set Realistic Thresholds**
   - Start with the SonarQube default of 3% duplication
   - Adjust based on your codebase and team standards

2. **Regular Monitoring**
   - Track duplication trends over time
   - Address high-impact duplications first (largest blocks)

3. **Refactoring Strategy**
   - Extract duplicate blocks into shared functions
   - Create utility modules for common patterns
   - Use composition over copy-paste

4. **Integration**
   - Fail builds when duplication exceeds thresholds
   - Review duplication in pull requests
   - Set team goals for reduction

## Troubleshooting

### No Duplications Detected

If no duplications are found when you expect them:

1. Check the minimum thresholds (try lowering `JSCPD_MIN_LINES` and `JSCPD_MIN_TOKENS`)
2. Verify files are being scanned (check analyzer logs)
3. Ensure file types are supported by jscpd

### High False Positive Rate

If too many duplications are detected:

1. Increase minimum thresholds
2. Add file patterns to exclusions
3. Review common boilerplate code

## References

- [jscpd Documentation](https://github.com/kucherenko/jscpd)
- [SonarQube Duplication Standards](https://docs.sonarqube.org/latest/user-guide/metric-definitions/#duplications)
