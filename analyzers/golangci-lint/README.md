# golangci-lint Analyzer

Meta-linter for Go that runs multiple linters in parallel.

## Overview

This analyzer uses [golangci-lint](https://golangci-lint.run/) to scan Go code for bugs, code smells, and security vulnerabilities.

## Features

- **Multi-linter support**: Runs dozens of Go linters in a single pass
- **Go module support**: Works with projects that have `go.mod`
- **Smart categorization**: Maps linters to appropriate issue types
- **Severity mapping**: Style linters marked as MINOR, security issues as VULNERABILITY

## Requirements

- Go module (`go.mod`) must be present in the workspace
- Valid Go code structure

## Issue Mapping

### Rule ID Format

- With specific rule: `golangci:<linter>:<rule>` (e.g., `golangci:gosec:G401`)
- Without rule: `golangci:<linter>` (e.g., `golangci:errcheck`)

### Severity Mapping

- **MINOR**: Style linters (gofmt, gofumpt, goimports, revive, stylecheck, etc.)
- **MAJOR**: Default for most linters

### Type Mapping

- **VULNERABILITY**: Security linters (gosec, gas)
- **BUG**: Logic/correctness linters (govet, staticcheck, errcheck, ineffassign, typecheck)
- **CODE_SMELL**: Style and other linters

## Linter Categories

### Security Linters (→ VULNERABILITY)
- `gosec`: Go security checker

### Bug Detectors (→ BUG)
- `govet`: Official Go static analyzer
- `staticcheck`: Advanced static analysis
- `errcheck`: Checks for unchecked errors
- `ineffassign`: Detects ineffectual assignments
- `typecheck`: Type checking

### Style Linters (→ CODE_SMELL, MINOR)
- `gofmt`, `gofumpt`: Code formatting
- `goimports`: Import organization
- `revive`, `stylecheck`: Style guidelines
- `misspell`: Spelling checker
- And many more...

## Environment Variables

- `WORKSPACE`: Directory to scan (default: `/workspace`)
- `OUT_DIR`: Output directory for results (default: `/out`)

## Output Files

- `golangci.json`: Raw golangci-lint JSON output
- `report.json`: Standardized issue report
- `measures.json`: Metrics (issue counts by severity/type)
- `run.log`: Execution log
- `golangci.log`: golangci-lint stderr output

## Example Usage

```bash
docker run --rm \
  -v /path/to/go/project:/workspace \
  -v /path/to/output:/out \
  qubeless/analyzer-golangci-lint:latest
```

## Configuration

golangci-lint will automatically detect and use configuration files in the workspace:
- `.golangci.yml`
- `.golangci.yaml`
- `.golangci.toml`
- `.golangci.json`

## Limitations

- Requires a valid Go module (`go.mod`)
- Some linters may require additional setup or dependencies
- Performance depends on project size and number of enabled linters

## Testing

See the `examples/go-golangci-demo` directory for a test project with intentional issues.

## Version

Based on golangci-lint v1.61.0
