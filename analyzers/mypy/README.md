# Mypy Analyzer

Analyzer that runs [Mypy](https://mypy-lang.org/) to detect type errors in Python code.

## Features

- Executes Mypy on `/workspace` directory
- Reports type errors as BUG or CODE_SMELL based on heuristics
- Supports projects without configuration (uses Mypy defaults)
- Auto-detects Mypy configuration files (`mypy.ini`, `.mypy.ini`, `pyproject.toml`, `setup.cfg`)
- Parses both JSON output (if available) and text output for compatibility
- Excludes virtual environments and build directories

## Output

The analyzer produces three files in `/out`:

- **report.json** - Issues and rules in standard format
- **measures.json** - Metrics (issue counts by severity and type)
- **run.log** - Execution log for debugging

## Issue Mapping

### Rule Key
- Format: `mypy:<error_code>`
- Example: `mypy:assignment`, `mypy:call-arg`, `mypy:return-value`
- Falls back to `mypy:typing-error` if no error code is available

### Severity
- **MAJOR**: error, warning (default for most type errors)
- **MINOR**: note

### Type
- **BUG**: Type errors (default)
- **CODE_SMELL**: Notes, or errors mentioning "unused", "missing", "redundant", "unnecessary"

### Location
- `filePath`: Relative to workspace
- `line`, `column`: From Mypy output
- `endLine`, `endColumn`: Same as start (Mypy doesn't provide ranges)

## Execution

The analyzer runs the following command:

```bash
mypy /workspace --show-column-numbers --no-error-summary --hide-error-context --show-absolute-path
```

If a configuration file is found, it's passed via `--config-file`.

## Metrics

The `measures.json` file contains:

- `issues_total`: Total number of type errors
- `issues_by_severity.major`: Number of major severity issues
- `issues_by_severity.minor`: Number of minor severity issues
- `issues_by_type.bug`: Number of bugs
- `issues_by_type.code_smell`: Number of code smells

## Configuration

Mypy will automatically use configuration from:
- `mypy.ini`
- `.mypy.ini`
- `pyproject.toml`
- `setup.cfg`

If no configuration is found, Mypy runs with default settings.

## Example

See `examples/python-mypy-demo/` for a sample project with type errors.

## Testing

Run the test script to build and test the analyzer:

```bash
cd analyzers/mypy
./test.sh
```

This will:
1. Build the Docker image
2. Run the analyzer on the demo project
3. Validate the output files
4. Display sample issues

## Docker Image

Build:
```bash
docker build -t mypy-analyzer .
```

Run:
```bash
docker run --rm \
  -v /path/to/project:/workspace:ro \
  -v /path/to/output:/out \
  mypy-analyzer
```

## Version

Currently uses Mypy 1.8.0.
