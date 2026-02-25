# Bandit Analyzer

Docker-based security analyzer for Python projects using Bandit.

## Overview

This analyzer scans Python code for common security vulnerabilities using Bandit and produces standardized JSON reports compatible with the Qubeless analysis platform.

## Features

- Scans all Python files (`.py`) in the workspace for security vulnerabilities
- Excludes virtual environments and build directories
- Supports custom Bandit configurations (`.bandit`, `bandit.yaml`, `pyproject.toml`)
- Produces standardized JSON output with fingerprints
- Maps Bandit severity levels to standard severity levels
- All issues are typed as `VULNERABILITY`

## Severity Mapping

| Bandit Severity | Confidence | Severity  |
|-----------------|------------|-----------|
| LOW             | *          | MINOR     |
| MEDIUM          | *          | MAJOR     |
| HIGH            | LOW/MEDIUM | CRITICAL  |
| HIGH            | HIGH       | BLOCKER   |

## Issue Types

All Bandit findings are categorized as **VULNERABILITY** type issues.

## Build

The Qubeless platform expects the image to be tagged as `qubeless/analyzer-bandit:latest` (based on the directory name convention).

```bash
# Build and tag for local development
docker build -t qubeless/analyzer-bandit:latest .

# Or build with custom registry and tag
docker build -t qubeless/analyzer-bandit:1.0 .
docker tag qubeless/analyzer-bandit:1.0 qubeless/analyzer-bandit:latest
```

The seed script automatically detects this analyzer from the `analyzers/bandit/` directory and expects the image name `qubeless/analyzer-bandit:latest` (or with prefix from `ANALYZER_IMAGE_PREFIX` environment variable).

## Usage

```bash
docker run --rm \
  -v /path/to/project:/workspace:ro \
  -v /path/to/output:/out \
  qubeless/analyzer-bandit:latest
```

## Output Files

The analyzer produces three files in `/out`:

### 1. `report.json`

Standard analysis report containing:
- Analyzer metadata (name, version)
- Issues array with:
  - `ruleKey`: Bandit test ID (e.g., `bandit:B602`)
  - `severity`: Mapped severity level
  - `type`: Always `VULNERABILITY`
  - `filePath`: Relative path to file
  - `line`, `column`, `endLine`, `endColumn`: Location
  - `message`: Test name and issue description
  - `fingerprint`: SHA-256 hash for stable identification
- Rules catalog with all detected rules

Example:
```json
{
  "analyzer": {
    "name": "bandit",
    "version": "1.7.5"
  },
  "issues": [
    {
      "ruleKey": "bandit:B602",
      "severity": "MAJOR",
      "type": "VULNERABILITY",
      "filePath": "src/main.py",
      "line": 15,
      "column": 1,
      "endLine": 15,
      "endColumn": 1,
      "message": "subprocess_popen_with_shell_equals_true: subprocess call with shell=True identified",
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
    "issues_total": 5,
    "vulnerabilities_total": 5,
    "issues_by_severity.blocker": 1,
    "issues_by_severity.critical": 2,
    "issues_by_severity.major": 1,
    "issues_by_severity.minor": 1,
    "issues_by_severity.info": 0,
    "issues_by_type.bug": 0,
    "issues_by_type.code_smell": 0,
    "issues_by_type.vulnerability": 5
  }
}
```

### 3. `run.log`

Execution log with:
- Command executed
- Bandit version
- Files scanned count
- Vulnerabilities found count
- Any errors encountered

## Configuration

The analyzer automatically detects and uses Bandit configuration files in the workspace:
- `.bandit`
- `bandit.yaml`
- `.bandit.yaml`
- `pyproject.toml` (with Bandit configuration section)

If no config is found, Bandit uses its default configuration.

## Excluded Directories

The analyzer automatically excludes:
- `venv/`, `.venv/`
- `site-packages/`
- `dist/`, `build/`
- `__pycache__/`
- `.tox/`, `.eggs/`

## Common Vulnerability Types

Bandit detects various security issues including:
- **B602**: Shell injection via subprocess with shell=True
- **B301**: Pickle usage (deserialization vulnerabilities)
- **B307**: Use of eval() with untrusted input
- **B104**: Hardcoded bind to all interfaces (0.0.0.0)
- **B105-B107**: Hardcoded passwords/keys
- **B608**: SQL injection vulnerabilities
- **B201-B202**: Flask debug mode enabled
- And many more...

## Testing

See [test.sh](test.sh) for local testing instructions.

## Example Project

See [examples/python-bandit-demo](../../examples/python-bandit-demo) for a sample Python project with security vulnerabilities.
