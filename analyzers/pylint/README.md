# Pylint Analyzer

Docker-based analyzer for Python projects using Pylint.

## Overview

This analyzer scans Python code using Pylint and produces standardized JSON reports compatible with the Qubeless analysis platform.

## Features

- Scans all Python files (`.py`) in the workspace
- Excludes virtual environments and build directories
- Supports custom Pylint configurations (`.pylintrc`, `pyproject.toml`, `setup.cfg`)
- Produces standardized JSON output with fingerprints
- Maps Pylint message types to severity levels

## Severity Mapping

| Pylint Type | Severity  |
|-------------|-----------|
| Convention  | MINOR     |
| Refactor    | MINOR     |
| Warning     | MAJOR     |
| Error       | CRITICAL  |
| Fatal       | BLOCKER   |

## Type Inference

- **BUG**: Error and Fatal messages
- **CODE_SMELL**: Convention, Refactor, and Warning messages

## Build

The Qubeless platform expects the image to be tagged as `pylint-analyzer:latest` (based on the directory name convention).

```bash
# Build and tag for local development
docker build -t pylint-analyzer:latest .

# Or build with custom registry and tag
docker build -t qubeless/analyzer-pylint:1.0 .
docker tag qubeless/analyzer-pylint:1.0 pylint-analyzer:latest
```

The seed script automatically detects this analyzer from the `analyzers/pylint/` directory and expects the image name `pylint-analyzer:latest` (or with prefix from `ANALYZER_IMAGE_PREFIX` environment variable).

## Usage

```bash
docker run --rm \
  -v /path/to/project:/workspace:ro \
  -v /path/to/output:/out \
  pylint-analyzer:latest
```

## Output Files

The analyzer produces three files in `/out`:

### 1. `report.json`

Standard analysis report containing:
- Analyzer metadata (name, version)
- Issues array with:
  - `ruleKey`: Pylint rule ID (e.g., `pylint:unused-variable`)
  - `severity`: Mapped severity level
  - `type`: Issue type (BUG or CODE_SMELL)
  - `filePath`: Relative path to file
  - `line`, `column`, `endLine`, `endColumn`: Location
  - `message`: Issue description
  - `fingerprint`: SHA-256 hash for stable identification
- Rules catalog with all detected rules

Example:
```json
{
  "analyzer": {
    "name": "pylint",
    "version": "3.0.3"
  },
  "issues": [
    {
      "ruleKey": "pylint:unused-variable",
      "severity": "MAJOR",
      "type": "CODE_SMELL",
      "filePath": "src/main.py",
      "line": 42,
      "column": 5,
      "endLine": 42,
      "endColumn": 6,
      "message": "Unused variable 'x'",
      "fingerprint": "abc123..."
    }
  ],
  "rules": [...]
}
```

### 2. `measures.json`

Metrics summary:
```json
{
  "metrics": {
    "issues_total": 10,
    "issues_by_severity.blocker": 0,
    "issues_by_severity.critical": 2,
    "issues_by_severity.major": 5,
    "issues_by_severity.minor": 3,
    "issues_by_severity.info": 0,
    "issues_by_type.bug": 2,
    "issues_by_type.code_smell": 8,
    "issues_by_type.vulnerability": 0
  }
}
```

### 3. `run.log`

Execution log with:
- Command executed
- Pylint version
- Files scanned count
- Issues found count
- Any errors encountered

## Configuration

The analyzer automatically detects and uses Pylint configuration files in the workspace:
- `.pylintrc`
- `pylintrc`
- `pyproject.toml`
- `setup.cfg`

If no config is found, Pylint uses its default configuration.

## Excluded Directories

The analyzer automatically excludes:
- `venv/`, `.venv/`
- `site-packages/`
- `dist/`, `build/`
- `__pycache__/`
- `.tox/`, `.eggs/`

## Testing

See [test.sh](test.sh) for local testing instructions.

## Example Project

See [examples/python-pylint-demo](../../examples/python-pylint-demo) for a sample Python project with Pylint issues.
