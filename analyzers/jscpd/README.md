# jscpd Analyzer

Code duplication detection analyzer using [jscpd](https://github.com/kucherenko/jscpd).

## Features

- Detects code duplication across 150+ programming languages
- Configurable thresholds for minimum lines and tokens
- Generates detailed duplication reports with file locations

## Configuration

Environment variables:
- `JSCPD_MIN_LINES`: Minimum lines for duplication detection (default: 5)
- `JSCPD_MIN_TOKENS`: Minimum tokens for duplication detection (default: 50)

## Output

The analyzer produces:
- `report.json`: Duplication blocks with file paths and line numbers
- `measures.json`: Metrics including duplication percentage
- `run.log`: Execution log

## Usage

```bash
docker run -v /path/to/code:/workspace -v /path/to/output:/out qubeless/analyzer-jscpd
```
