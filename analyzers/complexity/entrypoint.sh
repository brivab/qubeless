#!/usr/bin/env bash
set -euo pipefail

OUT_DIR=${OUT_DIR:-/out}
WORKSPACE=${WORKSPACE:-/workspace}

mkdir -p "$OUT_DIR"

LIZARD_JSON="$OUT_DIR/lizard.json"
REPORT_JSON="$OUT_DIR/report.json"
MEASURES_JSON="$OUT_DIR/measures.json"
RUN_LOG="$OUT_DIR/run.log"

echo "Starting Complexity analyzer (lizard)" > "$RUN_LOG"
echo "Workspace: $WORKSPACE" >> "$RUN_LOG"

# Get lizard version
LIZARD_VERSION=$(lizard --version 2>/dev/null | head -n1 || echo "unknown")
echo "Lizard version: $LIZARD_VERSION" >> "$RUN_LOG"

# Configuration from environment
COMPLEXITY_THRESHOLD=${COMPLEXITY_THRESHOLD:-10}
COMPLEXITY_SEVERITY_MINOR_FROM=${COMPLEXITY_SEVERITY_MINOR_FROM:-11}
COMPLEXITY_SEVERITY_MAJOR_FROM=${COMPLEXITY_SEVERITY_MAJOR_FROM:-16}
COMPLEXITY_SEVERITY_CRITICAL_FROM=${COMPLEXITY_SEVERITY_CRITICAL_FROM:-26}
MAX_ISSUES=${MAX_ISSUES:-2000}

echo "Configuration:" >> "$RUN_LOG"
echo "  Threshold: $COMPLEXITY_THRESHOLD" >> "$RUN_LOG"
echo "  Severity Minor from: $COMPLEXITY_SEVERITY_MINOR_FROM" >> "$RUN_LOG"
echo "  Severity Major from: $COMPLEXITY_SEVERITY_MAJOR_FROM" >> "$RUN_LOG"
echo "  Severity Critical from: $COMPLEXITY_SEVERITY_CRITICAL_FROM" >> "$RUN_LOG"
echo "  Max issues: $MAX_ISSUES" >> "$RUN_LOG"

# Build exclusion list
EXCLUSIONS=(
  ".git"
  "node_modules"
  "dist"
  "build"
  "target"
  ".venv"
  "venv"
  "coverage"
  "out"
  ".next"
  ".nuxt"
  "__pycache__"
  ".eggs"
  ".tox"
  "site-packages"
  "vendor"
  "*.min.js"
  "*.min.css"
)

# Build exclude arguments for lizard
EXCLUDE_ARGS=""
for pattern in "${EXCLUSIONS[@]}"; do
  EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude \"$pattern\""
done

# Add custom exclusions if provided
if [ -n "${EXCLUDE_GLOB:-}" ]; then
  EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude \"$EXCLUDE_GLOB\""
  echo "  Custom exclusions: $EXCLUDE_GLOB" >> "$RUN_LOG"
fi

echo "Running lizard..." >> "$RUN_LOG"

# Run lizard with warnings-only output
# -w: warnings only format
# -C: CCN threshold
set +e
eval "lizard $EXCLUDE_ARGS -w -C \"$COMPLEXITY_THRESHOLD\" \"$WORKSPACE\" > \"$LIZARD_JSON\" 2>&1"
LIZARD_STATUS=$?
set -e

echo "Lizard exit code: $LIZARD_STATUS" >> "$RUN_LOG"

if [ $LIZARD_STATUS -ne 0 ] && [ $LIZARD_STATUS -ne 1 ]; then
  echo "Lizard encountered errors" >> "$RUN_LOG"
  cat "$LIZARD_JSON" >> "$RUN_LOG" 2>/dev/null || true
fi

# Parse lizard output and convert to standard format
ISSUES_COUNT=$(
  LIZARD_OUTPUT="$LIZARD_JSON" \
  REPORT_JSON="$REPORT_JSON" \
  MEASURES_JSON="$MEASURES_JSON" \
  WORKSPACE="$WORKSPACE" \
  LIZARD_VERSION="$LIZARD_VERSION" \
  COMPLEXITY_THRESHOLD="$COMPLEXITY_THRESHOLD" \
  COMPLEXITY_SEVERITY_MINOR_FROM="$COMPLEXITY_SEVERITY_MINOR_FROM" \
  COMPLEXITY_SEVERITY_MAJOR_FROM="$COMPLEXITY_SEVERITY_MAJOR_FROM" \
  COMPLEXITY_SEVERITY_CRITICAL_FROM="$COMPLEXITY_SEVERITY_CRITICAL_FROM" \
  MAX_ISSUES="$MAX_ISSUES" \
  python3 - <<'PYTHON' 2>>"$RUN_LOG"
import hashlib
import json
import os
import re
import sys

lizard_output_path = os.environ.get("LIZARD_OUTPUT")
report_path = os.environ.get("REPORT_JSON")
measures_path = os.environ.get("MEASURES_JSON")
workspace = os.environ.get("WORKSPACE", "/workspace")
analyzer_version = os.environ.get("LIZARD_VERSION", "unknown")

# Configuration
threshold = int(os.environ.get("COMPLEXITY_THRESHOLD", "10"))
severity_minor_from = int(os.environ.get("COMPLEXITY_SEVERITY_MINOR_FROM", "11"))
severity_major_from = int(os.environ.get("COMPLEXITY_SEVERITY_MAJOR_FROM", "16"))
severity_critical_from = int(os.environ.get("COMPLEXITY_SEVERITY_CRITICAL_FROM", "26"))
max_issues = int(os.environ.get("MAX_ISSUES", "2000"))

print(f"[parser] Threshold: {threshold}", file=sys.stderr)
print(f"[parser] Severity thresholds - Minor: {severity_minor_from}, Major: {severity_major_from}, Critical: {severity_critical_from}", file=sys.stderr)

def map_severity(complexity: int) -> str:
    """Map complexity value to severity level"""
    if complexity >= severity_critical_from:
        return "CRITICAL"
    elif complexity >= severity_major_from:
        return "MAJOR"
    elif complexity >= severity_minor_from:
        return "MINOR"
    else:
        return "INFO"

def normalize_path(path_value: str) -> str:
    """Normalize file path to be relative to workspace"""
    path = path_value or ""
    if not path:
        return path

    workspace_normalized = workspace.rstrip("/") + "/"
    if path.startswith(workspace_normalized):
        return path[len(workspace_normalized):]

    # Try to make it relative
    if os.path.isabs(path):
        try:
            return os.path.relpath(path, workspace)
        except ValueError:
            return path

    return path

# Read lizard output
lizard_output = ""
if lizard_output_path and os.path.isfile(lizard_output_path):
    try:
        with open(lizard_output_path, 'r', encoding='utf-8', errors='ignore') as f:
            lizard_output = f.read()
    except Exception as exc:
        print(f"[parser] Failed to read lizard output: {exc}", file=sys.stderr)

# Parse lizard output
# Format: <file_path>:<line>: warning: <function_name> has X NLOC, Y CCN, Z token, ...
# Example: src/app.py:42: warning: complex_function has 15 NLOC, 6 CCN, 62 token, 2 PARAM, 17 length

issues = []
metrics = {
    "total_functions": 0,
    "total_complexity": 0,
    "max_complexity": 0,
    "avg_complexity": 0.0,
    "functions_over_threshold": 0,
}

# Regex to parse lizard output lines
# Looking for pattern: file.ext:line: warning: function_name has X NLOC, Y CCN, ...
pattern = re.compile(
    r'^(.+?):(\d+):\s*warning:\s*(.+?)\s+has\s+\d+\s+NLOC,\s+(\d+)\s+CCN',
    re.MULTILINE
)

complexities = []
for match in pattern.finditer(lizard_output):
    file_path_raw = match.group(1).strip()
    line_num = int(match.group(2))
    function_name = match.group(3).strip()
    complexity_value = int(match.group(4))

    # Track metrics
    metrics["total_functions"] += 1
    metrics["total_complexity"] += complexity_value
    complexities.append(complexity_value)
    if complexity_value > metrics["max_complexity"]:
        metrics["max_complexity"] = complexity_value

    # Only create issues for functions exceeding threshold
    if complexity_value > threshold:
        metrics["functions_over_threshold"] += 1

        # Stop if we reached max issues
        if len(issues) >= max_issues:
            continue

        severity = map_severity(complexity_value)
        file_path = normalize_path(file_path_raw)

        message = f"Function '{function_name}' has cyclomatic complexity {complexity_value} (threshold {threshold})"

        # Create fingerprint
        fingerprint_source = f"complexity:cyclomatic|{file_path}|{line_num}|{function_name}"
        fingerprint = hashlib.sha256(fingerprint_source.encode("utf-8")).hexdigest()

        issues.append({
            "ruleKey": "complexity:cyclomatic",
            "severity": severity,
            "type": "CODE_SMELL",
            "filePath": file_path,
            "line": line_num,
            "column": 0,
            "endLine": line_num,
            "endColumn": 0,
            "message": message,
            "fingerprint": fingerprint,
        })

# Calculate average complexity
if metrics["total_functions"] > 0:
    metrics["avg_complexity"] = round(metrics["total_complexity"] / metrics["total_functions"], 2)

print(f"[parser] Found {metrics['total_functions']} functions", file=sys.stderr)
print(f"[parser] Functions over threshold: {metrics['functions_over_threshold']}", file=sys.stderr)
print(f"[parser] Max complexity: {metrics['max_complexity']}", file=sys.stderr)
print(f"[parser] Average complexity: {metrics['avg_complexity']}", file=sys.stderr)
print(f"[parser] Created {len(issues)} issues", file=sys.stderr)

# Build report
rules_catalog = [
    {
        "key": "complexity:cyclomatic",
        "name": "High Cyclomatic Complexity",
        "description": f"Functions with cyclomatic complexity exceeding {threshold} are harder to understand, test, and maintain. Consider refactoring into smaller functions.",
        "severity": "MAJOR",
        "type": "CODE_SMELL",
    }
]

report_payload = {
    "analyzer": {
        "key": "complexity",
        "name": "Complexity Analyzer",
        "version": analyzer_version,
        "language": "multi"
    },
    "issues": issues,
    "rules": rules_catalog,
}

with open(report_path, "w", encoding="utf-8") as f:
    json.dump(report_payload, f, indent=2)

# Calculate issue metrics
severity_keys = ["BLOCKER", "CRITICAL", "MAJOR", "MINOR", "INFO"]
type_keys = ["BUG", "CODE_SMELL", "VULNERABILITY"]

severity_counts = {key: 0 for key in severity_keys}
type_counts = {key: 0 for key in type_keys}

for issue in issues:
    severity_counts[issue["severity"]] = severity_counts.get(issue["severity"], 0) + 1
    type_counts[issue["type"]] = type_counts.get(issue["type"], 0) + 1

issue_metrics = {"issues_total": len(issues)}
for key in severity_keys:
    issue_metrics[f"issues_by_severity.{key.lower()}"] = severity_counts.get(key, 0)
for key in type_keys:
    issue_metrics[f"issues_by_type.{key.lower()}"] = type_counts.get(key, 0)

# Add complexity-specific metrics
complexity_metrics = {
    "complexity.total_functions": metrics["total_functions"],
    "complexity.functions_over_threshold": metrics["functions_over_threshold"],
    "complexity.max_complexity": metrics["max_complexity"],
    "complexity.avg_complexity": metrics["avg_complexity"],
    "complexity.total_complexity": metrics["total_complexity"],
}

# Merge metrics
all_metrics = {**issue_metrics, **complexity_metrics}

with open(measures_path, "w", encoding="utf-8") as f:
    json.dump({"metrics": all_metrics}, f, indent=2)

# Output issue count for shell script
print(len(issues))
PYTHON
)

if [ -z "$ISSUES_COUNT" ]; then
  ISSUES_COUNT=0
fi

echo "Issues in report: $ISSUES_COUNT" >> "$RUN_LOG"

if [ $LIZARD_STATUS -ne 0 ] && [ $LIZARD_STATUS -ne 1 ]; then
  echo "Analyzer completed with errors; results may be partial." >> "$RUN_LOG"
else
  echo "Analyzer completed successfully." >> "$RUN_LOG"
fi
