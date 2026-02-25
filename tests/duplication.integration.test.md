# Integration Test: Code Duplication Detection

## Test Scenario

This document outlines the integration test for the code duplication detection feature.

## Prerequisites

1. Docker image `qubeless/analyzer-jscpd:latest` is built
2. Database migration has been applied
3. API server is running
4. Test project with duplicated code exists at `examples/duplication-test`

## Test Steps

### 1. Run the Analyzer

```bash
docker run --rm \
  -e JSCPD_MIN_LINES=3 \
  -e JSCPD_MIN_TOKENS=10 \
  -v $(pwd)/examples/duplication-test:/workspace \
  -v $(pwd)/out/duplication-test:/out \
  qubeless/analyzer-jscpd:latest
```

**Expected Output:**

- `out/duplication-test/report.json` contains duplication blocks
- `out/duplication-test/measures.json` contains metrics
- Non-zero duplication percentage reported

### 2. Verify Analyzer Output

```bash
cat out/duplication-test/report.json | jq '.statistics'
```

**Expected Result:**

```json
{
  "duplicationPercent": 39.39,
  "duplicatedLines": 154,
  "totalSources": 6,
  "totalClones": 28
}
```

### 3. Test API Endpoints

#### Get Duplication Statistics

```bash
curl -X GET "http://localhost:3001/api/analyses/{analysisId}/duplication" \
  -H "Authorization: Bearer {token}"
```

**Expected Response:**

```json
{
  "duplicationPercent": 39.39,
  "duplicationBlocks": 28,
  "duplicatedLines": 154,
  "totalSources": 6,
  "totalClones": 28
}
```

### 4. Test Quality Gate

Quality gates support the `duplication_percent` metric by default.

## Validation Criteria

- ✅ Analyzer successfully detects duplications
- ✅ Database stores duplication blocks correctly
- ✅ API endpoints return accurate data
- ✅ Quality gate evaluates duplication metric
- ✅ UI displays duplication information
