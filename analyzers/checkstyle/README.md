# Checkstyle Analyzer

Static code analysis for Java code using [Checkstyle](https://checkstyle.org/).

## Overview

Checkstyle is a development tool to help programmers write Java code that adheres to a coding standard. It automates the process of checking Java code to spare humans of this boring (but important) task.

This analyzer detects **code style issues** in Java projects.

## Features

- **Language**: Java
- **Issue Type**: `CODE_SMELL` (code style violations)
- **Default Severity**: `MINOR` (configurable to `MAJOR` for critical modules)
- **Output Format**: Standard JSON with issues and metrics

## Configuration

### Custom Configuration

The analyzer looks for a custom Checkstyle configuration file in the following order:

1. `/workspace/checkstyle.xml`
2. `/workspace/config/checkstyle/checkstyle.xml`
3. `/workspace/.checkstyle.xml`

If no custom configuration is found, the analyzer uses the default **Google Java Style Guide** configuration.

### Default Configuration (Google Java Style)

The default configuration includes checks for:

- **Naming Conventions**: Package names, class names, method names, variables, constants
- **Imports**: Avoid wildcard imports, detect unused/redundant imports
- **Size Violations**: Line length (120 chars), method length (150 lines), parameter count (7 max)
- **Whitespace**: Proper spacing around operators, braces, etc.
- **Modifiers**: Correct modifier order
- **Blocks**: Proper use of braces, empty blocks
- **Coding**: Empty statements, equals/hashCode, boolean simplification, switch defaults, fall-through
- **Class Design**: Final classes, interface types, one top-level class
- **Indentation**: 2-space indentation (Google style)

## Source Directory Discovery

The analyzer automatically discovers Java source files in common locations:

1. `src/main/java` (Maven/Gradle standard)
2. `src`
3. `app/src/main/java` (Android projects)
4. `.` (root directory as fallback)

## Issue Mapping

### Rule Keys

Issues are identified by rule keys in the format: `checkstyle:<ModuleName>`

Examples:
- `checkstyle:MagicNumber`
- `checkstyle:UnusedImports`
- `checkstyle:LineLength`

### Severity Mapping

| Checkstyle Severity | Module Type | Mapped Severity |
|---------------------|-------------|-----------------|
| `error` | Any | `MAJOR` |
| `warning` | Critical modules* | `MAJOR` |
| `warning` | Standard | `MINOR` |
| `info` | Any | `INFO` |

*Critical modules include: `NullPointerException`, `EmptyStatement`, `MissingSwitchDefault`, `FallThrough`, `IllegalCatch`, `IllegalThrows`, `InnerAssignment`, `MagicNumber`, `SimplifyBooleanExpression`, `SimplifyBooleanReturn`

### Issue Type

All Checkstyle violations are mapped to: `CODE_SMELL`

## Example Output

```json
{
  "analyzer": {
    "name": "checkstyle",
    "version": "10.21.1"
  },
  "issues": [
    {
      "ruleKey": "checkstyle:LineLength",
      "severity": "MINOR",
      "type": "CODE_SMELL",
      "filePath": "src/main/java/com/example/MyClass.java",
      "line": 42,
      "column": 121,
      "endLine": 42,
      "endColumn": 121,
      "message": "Line is longer than 120 characters (found 135).",
      "fingerprint": "abc123..."
    }
  ],
  "rules": [
    {
      "key": "checkstyle:LineLength",
      "name": "LineLength",
      "description": "Line is longer than 120 characters (found 135).",
      "severity": "MINOR",
      "type": "CODE_SMELL"
    }
  ]
}
```

## Metrics

The analyzer generates the following metrics:

- `issues_total`: Total number of issues found
- `issues_by_severity.blocker`: Count of BLOCKER issues
- `issues_by_severity.critical`: Count of CRITICAL issues
- `issues_by_severity.major`: Count of MAJOR issues
- `issues_by_severity.minor`: Count of MINOR issues
- `issues_by_severity.info`: Count of INFO issues
- `issues_by_type.bug`: Count of BUG issues (always 0)
- `issues_by_type.code_smell`: Count of CODE_SMELL issues
- `issues_by_type.vulnerability`: Count of VULNERABILITY issues (always 0)
- `code_smells_total`: Total code smells (same as issues_total)

## Usage

### Docker

```bash
docker run --rm \
  -v /path/to/project:/workspace \
  -v /tmp/out:/out \
  qubeless/analyzer-checkstyle:latest
```

### Output Files

The analyzer generates the following files in `/out`:

- `report.json` - Standard issue report
- `measures.json` - Metrics summary
- `checkstyle.xml` - Raw Checkstyle XML output
- `run.log` - Execution log
- `checkstyle.log` - Checkstyle stdout/stderr

## Version

- **Checkstyle**: 10.21.1
- **Java Runtime**: Eclipse Temurin 17 JDK

## References

- [Checkstyle Official Website](https://checkstyle.org/)
- [Google Java Style Guide](https://google.github.io/styleguide/javaguide.html)
- [Checkstyle Checks Documentation](https://checkstyle.org/checks.html)
