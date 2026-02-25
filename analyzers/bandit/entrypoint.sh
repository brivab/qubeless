#!/usr/bin/env bash
set -euo pipefail

OUT_DIR=${OUT_DIR:-/out}
WORKSPACE=${WORKSPACE:-/workspace}

mkdir -p "$OUT_DIR"

BANDIT_JSON="$OUT_DIR/bandit.json"
REPORT_JSON="$OUT_DIR/report.json"
MEASURES_JSON="$OUT_DIR/measures.json"
RUN_LOG="$OUT_DIR/run.log"
BANDIT_STDOUT="$OUT_DIR/bandit.log"

echo "Starting Bandit analyzer" > "$RUN_LOG"
echo "Workspace: $WORKSPACE" >> "$RUN_LOG"

# Get Bandit version
BANDIT_VERSION=$(bandit --version 2>/dev/null | grep "bandit" | awk '{print $NF}' || echo "unknown")
echo "Bandit version: $BANDIT_VERSION" >> "$RUN_LOG"

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

# Look for custom Bandit config
CONFIG_PATH=""
for candidate in ".bandit" "bandit.yaml" ".bandit.yaml" "pyproject.toml"; do
  if [ -f "$WORKSPACE/$candidate" ]; then
    CONFIG_PATH="$WORKSPACE/$candidate"
    echo "Found config: $CONFIG_PATH" >> "$RUN_LOG"
    break
  fi
done

CONFIG_ARG=""
if [ -n "$CONFIG_PATH" ]; then
  CONFIG_ARG="-c $CONFIG_PATH"
fi

# Run Bandit with JSON output
CMD="bandit -r $WORKSPACE -f json $CONFIG_ARG -o $BANDIT_JSON"
echo "Command: $CMD" >> "$RUN_LOG"

set +e
if [ $PYTHON_FILES_COUNT -gt 0 ]; then
  bandit -r "$WORKSPACE" \
    -f json \
    $CONFIG_ARG \
    -o "$BANDIT_JSON" \
    --exclude "/venv/,/.venv/,/site-packages/,/dist/,/build/,/__pycache__/,/.tox/,/.eggs/" \
    > "$BANDIT_STDOUT" 2>&1
  BANDIT_STATUS=$?
else
  echo '{"results": [], "metrics": {}}' > "$BANDIT_JSON"
  BANDIT_STATUS=0
fi
set -e

echo "Bandit exit code: $BANDIT_STATUS" >> "$RUN_LOG"

# Bandit exit codes: 0 = no issues, 1 = issues found, >1 = error
if [ $BANDIT_STATUS -ge 2 ]; then
  echo "Bandit encountered errors" >> "$RUN_LOG"
  echo "---- Bandit output ----" >> "$RUN_LOG"
  cat "$BANDIT_STDOUT" >> "$RUN_LOG" || true
  echo "-----------------------" >> "$RUN_LOG"
fi

# Parse Bandit JSON and convert to standard format
ISSUES_COUNT=$(
  BANDIT_JSON="$BANDIT_JSON" \
  REPORT_JSON="$REPORT_JSON" \
  MEASURES_JSON="$MEASURES_JSON" \
  WORKSPACE="$WORKSPACE" \
  BANDIT_VERSION="$BANDIT_VERSION" \
  python3 - <<'PYTHON' 2>>"$RUN_LOG"
import hashlib
import json
import os
import sys

bandit_json_path = os.environ.get("BANDIT_JSON")
report_path = os.environ.get("REPORT_JSON")
measures_path = os.environ.get("MEASURES_JSON")
workspace = os.environ.get("WORKSPACE", "/workspace")
analyzer_version = os.environ.get("BANDIT_VERSION", "unknown")

# Read Bandit JSON output
data = {}
if bandit_json_path and os.path.isfile(bandit_json_path):
    try:
        with open(bandit_json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as exc:
        print(f"[parser] failed to parse Bandit JSON: {exc}", file=sys.stderr)
        data = {}
else:
    print(f"[parser] Bandit JSON not found: {bandit_json_path}", file=sys.stderr)

# Severity mapping
# Bandit severities: LOW, MEDIUM, HIGH
# Optional: HIGH + HIGH confidence -> BLOCKER
severity_map = {
    "LOW": "MINOR",
    "MEDIUM": "MAJOR",
    "HIGH": "CRITICAL",
}

def map_severity(bandit_severity: str, confidence: str) -> str:
    """Map Bandit severity to standard severity"""
    sev = str(bandit_severity or "LOW").upper()
    conf = str(confidence or "LOW").upper()

    # Optional: HIGH severity + HIGH confidence = BLOCKER
    if sev == "HIGH" and conf == "HIGH":
        return "BLOCKER"

    return severity_map.get(sev, "MINOR")

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

# Process issues
issues = []
rules_catalog = {}

# Bandit results are in data["results"]
results = data.get("results", [])

for item in results:
    test_id = item.get("test_id") or ""
    test_name = item.get("test_name") or ""
    issue_text = (item.get("issue_text") or "").strip()

    # Build rule key: bandit:<test_id>
    rule_key = f"bandit:{test_id}" if test_id else "bandit:unknown"

    # Message: combine test_name and issue_text (without sensitive info)
    message = f"{test_name}: {issue_text}" if test_name else issue_text

    # Severity mapping
    bandit_severity = item.get("issue_severity") or "LOW"
    confidence = item.get("issue_confidence") or "LOW"
    severity = map_severity(bandit_severity, confidence)

    # Type is always VULNERABILITY for Bandit
    issue_type = "VULNERABILITY"

    # File location
    file_path = normalize_path(item.get("filename") or "")
    line = item.get("line_number")
    # Bandit provides line_range [start, end] but we'll use line_number for simplicity
    # column is not always provided by Bandit, default to 1
    column = item.get("col_offset", 1)
    end_line = line
    end_column = column

    # Create stable fingerprint
    fingerprint_source = f"{rule_key}|{file_path}|{line}|{message}"
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
        "message": message,
        "fingerprint": fingerprint,
    })

    # Collect unique rules
    if rule_key not in rules_catalog:
        rules_catalog[rule_key] = {
            "key": rule_key,
            "name": test_name or test_id or "Unknown security issue",
            "description": issue_text[:200] if issue_text else "",
            "severity": severity,
            "type": issue_type,
        }

print(f"[parser] Processed {len(issues)} vulnerabilities from Bandit", file=sys.stderr)
print(f"[parser] Extracted {len(rules_catalog)} unique rules", file=sys.stderr)

# Build report
report_payload = {
    "analyzer": {"name": "bandit", "version": analyzer_version},
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
# Add vulnerabilities_total metric
metrics["vulnerabilities_total"] = len(issues)

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

if [ $BANDIT_STATUS -ge 2 ]; then
  echo "Analyzer completed with errors; results may be partial." >> "$RUN_LOG"
else
  echo "Analyzer completed successfully." >> "$RUN_LOG"
fi
