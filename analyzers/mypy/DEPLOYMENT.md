# Mypy Analyzer - Deployment Guide

## Overview

This analyzer runs Mypy to detect type errors in Python code and converts the results to the standard Qubeless format.

## Architecture

### Components

1. **Dockerfile** - Builds the analyzer image with Mypy 1.8.0
2. **entrypoint.sh** - Main execution script
3. **Python parser** - Embedded in entrypoint.sh, converts Mypy output to standard format

### Execution Flow

```
┌─────────────────┐
│  Find Python    │
│  files in       │
│  /workspace     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Look for Mypy  │
│  config files   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Run Mypy with  │
│  JSON output    │
│  (or text)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Parse output   │
│  and convert to │
│  standard JSON  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Generate       │
│  report.json &  │
│  measures.json  │
└─────────────────┘
```

## Input

### Environment Variables

- `WORKSPACE=/workspace` - Directory to analyze (read-only mount)
- `OUT_DIR=/out` - Output directory for results

### Mounted Volumes

- `/workspace` - Project source code (read-only)
- `/out` - Output directory (read-write)

## Output Files

### report.json

Standard format with:

```json
{
  "analyzer": {
    "name": "mypy",
    "version": "1.8.0"
  },
  "issues": [
    {
      "ruleKey": "mypy:assignment",
      "severity": "MAJOR",
      "type": "BUG",
      "filePath": "main.py",
      "line": 15,
      "column": 5,
      "endLine": 15,
      "endColumn": 5,
      "message": "Incompatible types in assignment (expression has type \"str\", variable has type \"int\")",
      "fingerprint": "abc123..."
    }
  ],
  "rules": [
    {
      "key": "mypy:assignment",
      "name": "assignment",
      "description": "Incompatible types in assignment...",
      "severity": "MAJOR",
      "type": "BUG"
    }
  ]
}
```

### measures.json

Metrics summary:

```json
{
  "metrics": {
    "issues_total": 12,
    "issues_by_severity.blocker": 0,
    "issues_by_severity.critical": 0,
    "issues_by_severity.major": 10,
    "issues_by_severity.minor": 2,
    "issues_by_severity.info": 0,
    "issues_by_type.bug": 10,
    "issues_by_type.code_smell": 2,
    "issues_by_type.vulnerability": 0
  }
}
```

### run.log

Execution log with:
- Mypy version
- Files scanned count
- Configuration file detected (if any)
- Exit code
- Parser debug messages

## Mypy Output Parsing

### JSON Mode (Preferred)

If Mypy supports `--output json`, the output is structured JSON:

```json
[
  {
    "file": "/workspace/main.py",
    "line": 15,
    "column": 5,
    "type": "error",
    "message": "Incompatible types in assignment",
    "code": "assignment"
  }
]
```

### Text Mode (Fallback)

If JSON output is not available, parse text output:

```
/workspace/main.py:15:5: error: Incompatible types in assignment [assignment]
```

Regex pattern:
```
^(.+?):(\d+):(\d+):\s+(error|note|warning):\s+(.+?)(?:\s+\[(.+?)\])?$
```

## Issue Classification

### Severity Mapping

| Mypy Type | Severity |
|-----------|----------|
| error     | MAJOR    |
| warning   | MAJOR    |
| note      | MINOR    |

### Type Inference

| Condition | Type |
|-----------|------|
| `type == "note"` | CODE_SMELL |
| `type == "error"` AND message contains "unused", "missing", "redundant", "unnecessary" | CODE_SMELL |
| `type == "error"` (default) | BUG |

## Configuration Detection

Mypy config files are searched in order:
1. `mypy.ini`
2. `.mypy.ini`
3. `pyproject.toml`
4. `setup.cfg`

First found is used via `--config-file=<path>`.

## File Discovery

Finds all `.py` files recursively, excluding:
- `*/venv/*`
- `*/.venv/*`
- `*/site-packages/*`
- `*/dist/*`
- `*/build/*`
- `*/__pycache__/*`
- `*/.tox/*`
- `*/.eggs/*`

## Exit Codes

- `0` - No type errors found
- `1` - Type errors found (normal operation)
- `2+` - Mypy encountered errors (partial results)

The analyzer always succeeds and produces output files, even if Mypy fails.

## Error Handling

1. **No Python files**: Produces empty report with 0 issues
2. **Mypy crash**: Logs error, produces partial results
3. **Parse failure**: Logs error, continues with available data

## Testing

### Local Testing

```bash
cd analyzers/mypy
./test.sh
```

### Manual Testing

```bash
# Build image
docker build -t mypy-analyzer .

# Run on demo project
docker run --rm \
  -v $PWD/../../examples/python-mypy-demo:/workspace:ro \
  -v $PWD/test-output:/out \
  mypy-analyzer

# Check results
cat test-output/report.json | jq '.issues | length'
cat test-output/measures.json | jq '.metrics.issues_total'
```

## Integration

### API Payload

The analyzer is invoked by the Qubeless API via Docker:

```bash
docker run --rm \
  -v <project-path>:/workspace:ro \
  -v <output-path>:/out \
  qubeless/mypy-analyzer:latest
```

### Expected Results

For the demo project (`examples/python-mypy-demo`):
- At least 10-12 type errors
- Mix of BUG and CODE_SMELL types
- MAJOR and MINOR severities
- Clear error messages with file locations

## Maintenance

### Updating Mypy Version

Edit `Dockerfile`:
```dockerfile
RUN pip install --no-cache-dir mypy==<new-version>
```

Rebuild and test:
```bash
docker build -t mypy-analyzer .
./test.sh
```

### Adding New Rules

Mypy error codes are automatically extracted from output. No manual rule definition needed.

## Troubleshooting

### No issues found

Check:
1. Python files exist in workspace
2. Mypy is actually finding type errors
3. Check `run.log` for Mypy output

### JSON parse errors

Fallback to text parsing is automatic. Check `run.log` for parser mode.

### Missing error codes

Some Mypy errors may not have error codes. They'll use `mypy:typing-error` as fallback.

## Performance

- **Small projects** (<100 files): ~5-10 seconds
- **Medium projects** (100-1000 files): ~30-60 seconds
- **Large projects** (>1000 files): 1-5 minutes

Mypy's incremental mode is disabled to ensure consistent results.
