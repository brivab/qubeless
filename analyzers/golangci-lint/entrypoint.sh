#!/usr/bin/env bash
set -euo pipefail

OUT_DIR=${OUT_DIR:-/out}
WORKSPACE=${WORKSPACE:-/workspace}

mkdir -p "$OUT_DIR"

GOLANGCI_JSON="$OUT_DIR/golangci.json"
REPORT_JSON="$OUT_DIR/report.json"
MEASURES_JSON="$OUT_DIR/measures.json"
RUN_LOG="$OUT_DIR/run.log"
GOLANGCI_STDOUT="$OUT_DIR/golangci.log"

echo "Starting golangci-lint analyzer" > "$RUN_LOG"
echo "Workspace: $WORKSPACE" >> "$RUN_LOG"

# Get golangci-lint version
GOLANGCI_VERSION=$(golangci-lint --version 2>/dev/null | head -n1 | awk '{print $NF}' || echo "unknown")
echo "golangci-lint version: $GOLANGCI_VERSION" >> "$RUN_LOG"

# Check if go.mod exists
if [ ! -f "$WORKSPACE/go.mod" ]; then
  echo "No go.mod found in workspace" >> "$RUN_LOG"
  echo "golangci-lint requires a Go module in the workspace" >> "$RUN_LOG"

  # Create empty results
  echo '{"Issues": []}' > "$GOLANGCI_JSON"
  GOLANGCI_STATUS=0
else
  echo "Found go.mod in workspace" >> "$RUN_LOG"

  # Run golangci-lint with JSON output
  # We run it from the workspace directory to properly detect the module
  CMD="cd $WORKSPACE && golangci-lint run --out-format json --issues-exit-code 0 ./..."
  echo "Command: $CMD" >> "$RUN_LOG"

  set +e
  (cd "$WORKSPACE" && golangci-lint run --out-format json --issues-exit-code 0 ./...) > "$GOLANGCI_JSON" 2> "$GOLANGCI_STDOUT"
  GOLANGCI_STATUS=$?
  set -e

  echo "golangci-lint exit code: $GOLANGCI_STATUS" >> "$RUN_LOG"

  if [ $GOLANGCI_STATUS -ne 0 ]; then
    echo "golangci-lint encountered errors" >> "$RUN_LOG"
    echo "---- golangci-lint stderr ----" >> "$RUN_LOG"
    cat "$GOLANGCI_STDOUT" >> "$RUN_LOG" || true
    echo "------------------------------" >> "$RUN_LOG"
  fi

  # Check if JSON output exists
  if [ ! -f "$GOLANGCI_JSON" ]; then
    echo "golangci-lint JSON output not found, creating empty result" >> "$RUN_LOG"
    echo '{"Issues": []}' > "$GOLANGCI_JSON"
  fi
fi

# Parse golangci-lint JSON and convert to standard format
ISSUES_COUNT=$(
  GOLANGCI_JSON="$GOLANGCI_JSON" \
  REPORT_JSON="$REPORT_JSON" \
  MEASURES_JSON="$MEASURES_JSON" \
  WORKSPACE="$WORKSPACE" \
  GOLANGCI_VERSION="$GOLANGCI_VERSION" \
  python3 - <<'PYTHON' 2>>"$RUN_LOG"
import hashlib
import json
import os
import sys

golangci_json_path = os.environ.get("GOLANGCI_JSON")
report_path = os.environ.get("REPORT_JSON")
measures_path = os.environ.get("MEASURES_JSON")
workspace = os.environ.get("WORKSPACE", "/workspace")
analyzer_version = os.environ.get("GOLANGCI_VERSION", "unknown")

# Read golangci-lint JSON output
data = {}
issues_list = []
if golangci_json_path and os.path.isfile(golangci_json_path):
    try:
        with open(golangci_json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        issues_list = data.get("Issues") or []
    except Exception as exc:
        print(f"[parser] failed to parse golangci-lint JSON: {exc}", file=sys.stderr)
        issues_list = []
else:
    print(f"[parser] golangci-lint JSON not found: {golangci_json_path}", file=sys.stderr)

# Style linters that should be MINOR severity
STYLE_LINTERS = {
    "gofmt", "gofumpt", "goimports", "gci", "gocritic",
    "revive", "stylecheck", "whitespace", "wsl", "nlreturn",
    "lll", "misspell", "godot", "exhaustruct"
}

# Security linters that should be VULNERABILITY
SECURITY_LINTERS = {
    "gosec", "gas"
}

def map_severity(linter_name: str) -> str:
    """
    Map linter to severity.
    - Style linters -> MINOR
    - Default -> MAJOR
    """
    linter = str(linter_name or "").lower()

    if linter in STYLE_LINTERS:
        return "MINOR"

    # Default severity
    return "MAJOR"

def infer_type(linter_name: str) -> str:
    """
    Infer issue type based on linter.
    - gosec/gas -> VULNERABILITY
    - Style linters -> CODE_SMELL
    - Others -> BUG or CODE_SMELL (heuristic)
    """
    linter = str(linter_name or "").lower()

    if linter in SECURITY_LINTERS:
        return "VULNERABILITY"

    if linter in STYLE_LINTERS:
        return "CODE_SMELL"

    # Default: BUG for logic issues, CODE_SMELL for others
    # Heuristic: if it's a common bug detector, use BUG
    BUG_LINTERS = {"govet", "staticcheck", "errcheck", "ineffassign", "typecheck"}
    if linter in BUG_LINTERS:
        return "BUG"

    return "CODE_SMELL"

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

for item in issues_list:
    # Get linter info
    from_linter = item.get("FromLinter") or "unknown"

    # Build rule key
    # Prefer: golangci:<linter>:<rule> if rule is available
    # Otherwise: golangci:<linter>
    text = item.get("Text") or ""

    # Try to extract rule name from some linters
    # For example, gosec reports like "G401: Use of weak cryptographic primitive"
    rule_name = None
    if from_linter.lower() == "gosec" and text:
        # Extract G### from the beginning
        parts = text.split(":", 1)
        if len(parts) >= 1 and parts[0].strip().startswith("G"):
            rule_name = parts[0].strip()

    if rule_name:
        rule_key = f"golangci:{from_linter}:{rule_name}"
    else:
        rule_key = f"golangci:{from_linter}"

    # Map severity and type
    severity = map_severity(from_linter)
    issue_type = infer_type(from_linter)

    # File location
    pos = item.get("Pos") or {}
    file_path = normalize_path(pos.get("Filename") or "")
    line = pos.get("Line", 1)
    column = pos.get("Column", 0)

    # golangci-lint doesn't provide end position, use same as start
    end_line = line
    end_column = column

    # Message
    message = text or "Issue detected by golangci-lint"

    # Create stable fingerprint
    fingerprint_source = f"{rule_key}|{file_path}|{line}|{column}|{message}"
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
        # For rule description, use the linter name and optional rule
        rule_description = f"{from_linter} linter"
        if rule_name:
            rule_description += f" - {rule_name}"

        rules_catalog[rule_key] = {
            "key": rule_key,
            "name": rule_name or from_linter,
            "description": rule_description,
            "severity": severity,
            "type": issue_type,
        }

print(f"[parser] Processed {len(issues)} issues from golangci-lint", file=sys.stderr)
print(f"[parser] Extracted {len(rules_catalog)} unique rules", file=sys.stderr)

# Build report
report_payload = {
    "analyzer": {"name": "golangci-lint", "version": analyzer_version},
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

if [ $GOLANGCI_STATUS -ne 0 ]; then
  echo "Analyzer completed with errors; results may be partial." >> "$RUN_LOG"
else
  echo "Analyzer completed successfully." >> "$RUN_LOG"
fi
