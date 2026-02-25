#!/usr/bin/env bash
set -euo pipefail

OUT_DIR=${OUT_DIR:-/out}
WORKSPACE=${WORKSPACE:-/workspace}

mkdir -p "$OUT_DIR"

PYLINT_JSON="$OUT_DIR/pylint.json"
REPORT_JSON="$OUT_DIR/report.json"
MEASURES_JSON="$OUT_DIR/measures.json"
RUN_LOG="$OUT_DIR/run.log"
PYLINT_STDOUT="$OUT_DIR/pylint.log"

echo "Starting Pylint analyzer" > "$RUN_LOG"
echo "Workspace: $WORKSPACE" >> "$RUN_LOG"

# Get Pylint version
PYLINT_VERSION=$(pylint --version 2>/dev/null | head -n 1 | awk '{print $NF}')
if [ -z "$PYLINT_VERSION" ]; then
  PYLINT_VERSION="unknown"
fi

echo "Pylint version: $PYLINT_VERSION" >> "$RUN_LOG"

# Find all Python files, excluding common virtual env and build directories
echo "Discovering Python files..." >> "$RUN_LOG"
PYTHON_FILES=$(find "$WORKSPACE" -type f -name "*.py" \
  ! -path "*/venv/*" \
  ! -path "*/.venv/*" \
  ! -path "*/site-packages/*" \
  ! -path "*/dist/*" \
  ! -path "*/build/*" \
  ! -path "*/__pycache__/*" \
  ! -path "*/.tox/*" \
  ! -path "*/.eggs/*" \
  2>/dev/null || true)

if [ -z "$PYTHON_FILES" ]; then
  echo "No Python files found in workspace" >> "$RUN_LOG"
  PYTHON_FILES_COUNT=0
else
  PYTHON_FILES_COUNT=$(echo "$PYTHON_FILES" | wc -l | tr -d ' ')
fi

echo "Found $PYTHON_FILES_COUNT Python file(s)" >> "$RUN_LOG"

# Look for custom Pylint config
CONFIG_PATH=""
for candidate in ".pylintrc" "pylintrc" "pyproject.toml" "setup.cfg"; do
  if [ -f "$WORKSPACE/$candidate" ]; then
    CONFIG_PATH="$WORKSPACE/$candidate"
    echo "Found config: $CONFIG_PATH" >> "$RUN_LOG"
    break
  fi
done

CONFIG_ARG=""
if [ -n "$CONFIG_PATH" ]; then
  CONFIG_ARG="--rcfile=$CONFIG_PATH"
fi

# Run Pylint with JSON output
CMD="pylint $CONFIG_ARG --output-format=json --reports=no"
echo "Command: $CMD" >> "$RUN_LOG"

set +e
if [ $PYTHON_FILES_COUNT -gt 0 ]; then
  echo "$PYTHON_FILES" | xargs pylint $CONFIG_ARG --output-format=json --reports=no > "$PYLINT_JSON" 2>"$PYLINT_STDOUT"
  PYLINT_STATUS=$?
else
  echo "[]" > "$PYLINT_JSON"
  PYLINT_STATUS=0
fi
set -e

echo "Pylint exit code: $PYLINT_STATUS" >> "$RUN_LOG"

if [ $PYLINT_STATUS -ge 2 ]; then
  echo "Pylint encountered errors" >> "$RUN_LOG"
  echo "---- Pylint stderr ----" >> "$RUN_LOG"
  cat "$PYLINT_STDOUT" >> "$RUN_LOG" || true
  echo "-----------------------" >> "$RUN_LOG"
fi

# Parse Pylint JSON and convert to standard format
ISSUES_COUNT=$(
  PYLINT_JSON="$PYLINT_JSON" \
  REPORT_JSON="$REPORT_JSON" \
  MEASURES_JSON="$MEASURES_JSON" \
  WORKSPACE="$WORKSPACE" \
  PYLINT_VERSION="$PYLINT_VERSION" \
  python3 - <<'PYTHON' 2>>"$RUN_LOG"
import hashlib
import json
import os
import sys

pylint_json_path = os.environ.get("PYLINT_JSON")
report_path = os.environ.get("REPORT_JSON")
measures_path = os.environ.get("MEASURES_JSON")
workspace = os.environ.get("WORKSPACE", "/workspace")
analyzer_version = os.environ.get("PYLINT_VERSION", "unknown")

# Read Pylint JSON output
data = []
if pylint_json_path and os.path.isfile(pylint_json_path):
    try:
        with open(pylint_json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as exc:
        print(f"[parser] failed to parse Pylint JSON: {exc}", file=sys.stderr)
        data = []
else:
    print(f"[parser] Pylint JSON not found: {pylint_json_path}", file=sys.stderr)

# Severity mapping
# Pylint types: convention (C), refactor (R), warning (W), error (E), fatal (F)
severity_map = {
    "convention": "MINOR",
    "refactor": "MINOR",
    "warning": "MAJOR",
    "error": "CRITICAL",
    "fatal": "BLOCKER",
}

def map_severity(pylint_type: str) -> str:
    """Map Pylint message type to severity"""
    key = str(pylint_type or "").lower()
    return severity_map.get(key, "MINOR")

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

def infer_type(pylint_type: str, severity: str) -> str:
    """Infer issue type based on Pylint message type and severity"""
    pylint_type_lower = str(pylint_type or "").lower()

    # Errors and fatals are bugs
    if pylint_type_lower in ("error", "fatal"):
        return "BUG"

    # Warnings are bugs if critical
    if pylint_type_lower == "warning" and severity in ("CRITICAL", "BLOCKER"):
        return "BUG"

    # Everything else is code smell
    return "CODE_SMELL"

# Process issues
issues = []
rules_catalog = {}

for item in data:
    message_text = (item.get("message") or "").strip()
    message_id = item.get("message-id") or ""
    symbol = item.get("symbol") or ""

    # Prefer symbol over message-id for rule key
    rule_id = symbol if symbol else message_id
    rule_key = f"pylint:{rule_id}" if rule_id else "pylint:unknown"

    pylint_type = item.get("type") or "convention"
    severity = map_severity(pylint_type)
    issue_type = infer_type(pylint_type, severity)

    file_path = normalize_path(item.get("path") or item.get("file") or "")
    line = item.get("line")
    column = item.get("column")
    end_line = item.get("endLine") or line
    end_column = item.get("endColumn") or column

    # Create stable fingerprint
    fingerprint_source = f"{rule_key}|{file_path}|{line}|{message_text}"
    fingerprint = hashlib.sha256(fingerprint_source.encode("utf-8")).hexdigest()

    issues.append({
        "ruleKey": rule_key,
        "severity": severity,
        "type": issue_type,
        "filePath": file_path,
        "line": line,
        "column": column,
        "endLine": end_line,
        "endColumn": end_column,
        "message": message_text,
        "fingerprint": fingerprint,
    })

    # Collect unique rules
    if rule_key not in rules_catalog:
        rules_catalog[rule_key] = {
            "key": rule_key,
            "name": symbol or message_id or "Unknown rule",
            "description": message_text[:200] if message_text else "",
            "severity": severity,
            "type": issue_type,
        }

print(f"[parser] Processed {len(issues)} issues from Pylint", file=sys.stderr)
print(f"[parser] Extracted {len(rules_catalog)} unique rules", file=sys.stderr)

# Build report
report_payload = {
    "analyzer": {"name": "pylint", "version": analyzer_version},
    "issues": issues,
    "rules": list(rules_catalog.values()),
}

with open(report_path, "w", encoding="utf-8") as f:
    json.dump(report_payload, f, indent=2)

# Calculate metrics
severity_keys = ["BLOCKER", "CRITICAL", "MAJOR", "MINOR", "INFO"]
type_keys = ["BUG", "CODE_SMELL", "VULNERABILITY"]

severity_counts = {key: 0 for key in severity_keys}
type_counts = {key: 0 for key in type_keys}

for issue in issues:
    severity_counts[issue["severity"]] = severity_counts.get(issue["severity"], 0) + 1
    type_counts[issue["type"]] = type_counts.get(issue["type"], 0) + 1

metrics = {"issues_total": len(issues)}
for key in severity_keys:
    metrics[f"issues_by_severity.{key.lower()}"] = severity_counts.get(key, 0)
for key in type_keys:
    metrics[f"issues_by_type.{key.lower()}"] = type_counts.get(key, 0)

with open(measures_path, "w", encoding="utf-8") as f:
    json.dump({"metrics": metrics}, f, indent=2)

# Output issue count for shell script
print(len(issues))
PYTHON
)

if [ -z "$ISSUES_COUNT" ]; then
  ISSUES_COUNT=0
fi

echo "Issues in report: $ISSUES_COUNT" >> "$RUN_LOG"
echo "Files scanned: $PYTHON_FILES_COUNT" >> "$RUN_LOG"

if [ $PYLINT_STATUS -ge 2 ]; then
  echo "Analyzer completed with errors; results may be partial." >> "$RUN_LOG"
else
  echo "Analyzer completed successfully." >> "$RUN_LOG"
fi
