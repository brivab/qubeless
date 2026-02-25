# Complexity Analyzer

Multi-language cyclomatic complexity analyzer using [Lizard](https://github.com/terryyin/lizard).

## Overview

This analyzer detects functions and methods with high cyclomatic complexity across multiple programming languages. High complexity often indicates code that is difficult to understand, test, and maintain.

## Supported Languages

Lizard supports the following languages:

- C/C++
- Java
- C#
- JavaScript
- TypeScript
- Python
- Objective-C
- Swift
- Scala
- GDScript
- Go
- Lua
- Rust
- PHP
- Ruby
- Kotlin
- Fortran

## How it Works

The analyzer:

1. Scans the workspace for source files in supported languages
2. Calculates the cyclomatic complexity (CCN) for each function/method
3. Reports functions exceeding the configured threshold
4. Maps complexity values to severity levels

## Configuration

Configure the analyzer using environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `COMPLEXITY_THRESHOLD` | 10 | Minimum complexity to trigger an issue |
| `COMPLEXITY_SEVERITY_MINOR_FROM` | 11 | Complexity value for MINOR severity |
| `COMPLEXITY_SEVERITY_MAJOR_FROM` | 16 | Complexity value for MAJOR severity |
| `COMPLEXITY_SEVERITY_CRITICAL_FROM` | 26 | Complexity value for CRITICAL severity |
| `MAX_ISSUES` | 2000 | Maximum number of issues to report |
| `EXCLUDE_GLOB` | - | Additional glob pattern to exclude |

### Severity Mapping

By default:

- **INFO**: Complexity 1-10 (not reported by default)
- **MINOR**: Complexity 11-15
- **MAJOR**: Complexity 16-25
- **CRITICAL**: Complexity 26+

## Example Usage

### Basic Usage

```bash
docker run --rm \
  -v /path/to/code:/workspace:ro \
  -v /path/to/output:/out \
  qubeless/analyzer-complexity:latest
```

### Custom Thresholds

```bash
docker run --rm \
  -v /path/to/code:/workspace:ro \
  -v /path/to/output:/out \
  -e COMPLEXITY_THRESHOLD=15 \
  -e COMPLEXITY_SEVERITY_MAJOR_FROM=20 \
  -e COMPLEXITY_SEVERITY_CRITICAL_FROM=30 \
  qubeless/analyzer-complexity:latest
```

## Output Files

### report.json

Standard issue format:

```json
{
  "analyzer": {
    "key": "complexity",
    "name": "Complexity Analyzer",
    "version": "1.17.10",
    "language": "multi"
  },
  "issues": [
    {
      "ruleKey": "complexity:cyclomatic",
      "severity": "MAJOR",
      "type": "CODE_SMELL",
      "filePath": "src/app.py",
      "line": 42,
      "column": 0,
      "endLine": 42,
      "endColumn": 0,
      "message": "Function 'process_data' has cyclomatic complexity 18 (threshold 10)",
      "fingerprint": "abc123..."
    }
  ],
  "rules": [
    {
      "key": "complexity:cyclomatic",
      "name": "High Cyclomatic Complexity",
      "description": "Functions with cyclomatic complexity exceeding 10 are harder to understand, test, and maintain. Consider refactoring into smaller functions.",
      "severity": "MAJOR",
      "type": "CODE_SMELL"
    }
  ]
}
```

### measures.json

Includes both issue metrics and complexity-specific metrics:

```json
{
  "metrics": {
    "issues_total": 12,
    "issues_by_severity.critical": 2,
    "issues_by_severity.major": 5,
    "issues_by_severity.minor": 5,
    "issues_by_type.code_smell": 12,
    "complexity.total_functions": 45,
    "complexity.functions_over_threshold": 12,
    "complexity.max_complexity": 32,
    "complexity.avg_complexity": 8.5,
    "complexity.total_complexity": 382
  }
}
```

## Exclusions

The analyzer automatically excludes:

- `.git/`
- `node_modules/`
- `dist/`, `build/`, `target/`
- `.venv/`, `venv/`
- `coverage/`
- `.next/`, `.nuxt/`
- `__pycache__/`
- `vendor/`
- `*.min.js`, `*.min.css`

## Understanding Cyclomatic Complexity

Cyclomatic complexity measures the number of linearly independent paths through a program's source code. Higher values indicate:

- More decision points (if/else, switch, loops, etc.)
- More test cases needed for full coverage
- Higher likelihood of bugs
- Reduced maintainability

### Recommended Thresholds

- **1-10**: Simple, easy to understand
- **11-15**: Moderate complexity, acceptable
- **16-25**: High complexity, consider refactoring
- **26+**: Very high complexity, refactoring recommended

## Building

```bash
docker build -t qubeless/analyzer-complexity:latest .
```

## Testing

Run the test script:

```bash
./test.sh
```

This will:
1. Build the Docker image
2. Run the analyzer on the demo project
3. Display the results
4. Validate output files

## Integration with Qubeless

The analyzer is designed to integrate seamlessly with the Qubeless platform. The worker will automatically:

1. Mount the codebase to `/workspace`
2. Provide output directory at `/out`
3. Pass any configured environment variables
4. Collect the generated reports

## Tips for Reducing Complexity

When you encounter high complexity warnings:

1. **Extract methods**: Break down complex functions into smaller, focused functions
2. **Early returns**: Use guard clauses to reduce nesting
3. **Strategy pattern**: Replace complex conditionals with polymorphism
4. **Lookup tables**: Replace nested if/else with data structures
5. **Simplify conditions**: Extract complex boolean logic into well-named functions

## Version

- Analyzer version: 1.0.0
- Lizard version: 1.17.10
- Python version: 3.11
