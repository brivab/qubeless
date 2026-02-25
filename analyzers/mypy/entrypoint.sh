#!/usr/bin/env bash
set -euo pipefail

OUT_DIR=${OUT_DIR:-/out}
WORKSPACE=${WORKSPACE:-/workspace}

mkdir -p "$OUT_DIR"

MYPY_JSON="$OUT_DIR/mypy.json"
REPORT_JSON="$OUT_DIR/report.json"
MEASURES_JSON="$OUT_DIR/measures.json"
RUN_LOG="$OUT_DIR/run.log"
MYPY_STDOUT="$OUT_DIR/mypy.log"

echo "Starting Mypy analyzer" > "$RUN_LOG"
echo "Workspace: $WORKSPACE" >> "$RUN_LOG"

# Get Mypy version
MYPY_VERSION=$(mypy --version 2>/dev/null | head -n 1 | awk '{print $2}')
if [ -z "$MYPY_VERSION" ]; then
  MYPY_VERSION="unknown"
fi

echo "Mypy version: $MYPY_VERSION" >> "$RUN_LOG"

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

# Look for custom Mypy config
CONFIG_PATH=""
for candidate in "mypy.ini" ".mypy.ini" "pyproject.toml" "setup.cfg"; do
  if [ -f "$WORKSPACE/$candidate" ]; then
    CONFIG_PATH="$WORKSPACE/$candidate"
    echo "Found config: $CONFIG_PATH" >> "$RUN_LOG"
    break
  fi
done

CONFIG_ARG=""
if [ -n "$CONFIG_PATH" ]; then
  CONFIG_ARG="--config-file=$CONFIG_PATH"
fi

# Run Mypy with machine-readable output
# We try JSON output first (if available), otherwise parse text output
CMD="mypy $CONFIG_ARG --show-column-numbers --no-error-summary --hide-error-context --show-absolute-path"
echo "Command: $CMD" >> "$RUN_LOG"

set +e
if [ $PYTHON_FILES_COUNT -gt 0 ]; then
  # Try JSON output format first (mypy >= 0.990)
  mypy $CONFIG_ARG --output json --show-column-numbers --no-error-summary --hide-error-context --show-absolute-path "$WORKSPACE" > "$MYPY_JSON" 2>"$MYPY_STDOUT"
  MYPY_STATUS=$?

  # If JSON output failed, fall back to text parsing
  if [ ! -s "$MYPY_JSON" ] || ! python3 -c "import json; json.load(open('$MYPY_JSON'))" 2>/dev/null; then
    echo "JSON output not available, using text parsing" >> "$RUN_LOG"
    mypy $CONFIG_ARG --show-column-numbers --no-error-summary --hide-error-context --show-absolute-path "$WORKSPACE" > "$MYPY_STDOUT" 2>&1
    MYPY_STATUS=$?
    # Create empty JSON for parser to detect text mode
    echo "[]" > "$MYPY_JSON"
  fi
else
  echo "[]" > "$MYPY_JSON"
  MYPY_STATUS=0
fi
set -e

echo "Mypy exit code: $MYPY_STATUS" >> "$RUN_LOG"

if [ $MYPY_STATUS -ne 0 ]; then
  echo "Mypy found type errors" >> "$RUN_LOG"
fi

# Parse Mypy output and convert to standard format
ISSUES_COUNT=$(
  MYPY_JSON="$MYPY_JSON" \
  MYPY_STDOUT="$MYPY_STDOUT" \
  REPORT_JSON="$REPORT_JSON" \
  MEASURES_JSON="$MEASURES_JSON" \
  WORKSPACE="$WORKSPACE" \
  MYPY_VERSION="$MYPY_VERSION" \
  python3 - <<'PYTHON' 2>>"$RUN_LOG"
import hashlib
import json
import os
import re
import sys

mypy_json_path = os.environ.get("MYPY_JSON")
mypy_stdout_path = os.environ.get("MYPY_STDOUT")
report_path = os.environ.get("REPORT_JSON")
measures_path = os.environ.get("MEASURES_JSON")
workspace = os.environ.get("WORKSPACE", "/workspace")
analyzer_version = os.environ.get("MYPY_VERSION", "unknown")

# Read Mypy JSON output (if available)
data = []
use_text_parsing = False

if mypy_json_path and os.path.isfile(mypy_json_path):
    try:
        with open(mypy_json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if not data or len(data) == 0:
            use_text_parsing = True
    except Exception as exc:
        print(f"[parser] failed to parse Mypy JSON: {exc}", file=sys.stderr)
        use_text_parsing = True
else:
    use_text_parsing = True

# Fall back to text parsing if JSON is not available
if use_text_parsing and mypy_stdout_path and os.path.isfile(mypy_stdout_path):
    print("[parser] Using text parsing mode", file=sys.stderr)
    with open(mypy_stdout_path, 'r', encoding='utf-8') as f:
        for line in f:
            # Parse format: file:line:col: error: message [error-code]
            # Example: /workspace/main.py:10:5: error: Incompatible types [assignment]
            match = re.match(r'^(.+?):(\d+):(\d+):\s+(error|note|warning):\s+(.+?)(?:\s+\[(.+?)\])?$', line.strip())
            if match:
                file_path = match.group(1)
                line_num = int(match.group(2))
                col_num = int(match.group(3))
                msg_type = match.group(4)
                message = match.group(5)
                error_code = match.group(6) or "typing-error"

                data.append({
                    "file": file_path,
                    "line": line_num,
                    "column": col_num,
                    "type": msg_type,
                    "message": message,
                    "code": error_code,
                })

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

def map_severity(msg_type: str) -> str:
    """Map Mypy message type to severity"""
    msg_type_lower = str(msg_type or "").lower()

    if msg_type_lower == "error":
        return "MAJOR"
    elif msg_type_lower == "note":
        return "MINOR"
    elif msg_type_lower == "warning":
        return "MAJOR"

    return "MAJOR"

def infer_type(msg_type: str, message: str) -> str:
    """Infer issue type based on Mypy message type"""
    msg_type_lower = str(msg_type or "").lower()
    message_lower = str(message or "").lower()

    # Notes are typically code smells
    if msg_type_lower == "note":
        return "CODE_SMELL"

    # Errors are bugs by default
    if msg_type_lower == "error":
        # Some errors are more like code smells
        if any(word in message_lower for word in ["unused", "missing", "redundant", "unnecessary"]):
            return "CODE_SMELL"
        return "BUG"

    # Default to bug for type errors
    return "BUG"

# Process issues
issues = []
rules_catalog = {}

for item in data:
    message_text = (item.get("message") or "").strip()
    error_code = item.get("code") or item.get("error_code") or "typing-error"

    rule_key = f"mypy:{error_code}"

    msg_type = item.get("type") or "error"
    severity = map_severity(msg_type)
    issue_type = infer_type(msg_type, message_text)

    file_path = normalize_path(item.get("file") or item.get("path") or "")
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
            "name": error_code or "typing-error",
            "description": message_text[:200] if message_text else "Type checking error",
            "severity": severity,
            "type": issue_type,
        }

print(f"[parser] Processed {len(issues)} issues from Mypy", file=sys.stderr)
print(f"[parser] Extracted {len(rules_catalog)} unique rules", file=sys.stderr)

# Build report
report_payload = {
    "analyzer": {"name": "mypy", "version": analyzer_version},
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

if [ $MYPY_STATUS -ne 0 ]; then
  echo "Analyzer completed with type errors." >> "$RUN_LOG"
else
  echo "Analyzer completed successfully." >> "$RUN_LOG"
fi
