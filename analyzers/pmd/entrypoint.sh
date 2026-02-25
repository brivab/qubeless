#!/usr/bin/env bash
set -euo pipefail

OUT_DIR=${OUT_DIR:-/out}
WORKSPACE=${WORKSPACE:-/workspace}

mkdir -p "$OUT_DIR"

PMD_XML="$OUT_DIR/pmd.xml"
PMD_JSON="$OUT_DIR/pmd.json"
REPORT_JSON="$OUT_DIR/report.json"
MEASURES_JSON="$OUT_DIR/measures.json"
RUN_LOG="$OUT_DIR/run.log"
PMD_STDOUT="$OUT_DIR/pmd.log"

echo "Starting PMD analyzer" > "$RUN_LOG"
echo "Workspace: $WORKSPACE" >> "$RUN_LOG"

# Get PMD version
PMD_VERSION=$(pmd --version 2>/dev/null | head -n 1 || echo "unknown")
echo "PMD version: $PMD_VERSION" >> "$RUN_LOG"

cd "$WORKSPACE"

# Find Java source directories
echo "Discovering Java source directories..." >> "$RUN_LOG"

# Common Java source locations
SOURCE_DIRS=""
for candidate in "src/main/java" "src" "app/src/main/java" "." ; do
  if [ -d "$WORKSPACE/$candidate" ]; then
    # Check if directory contains .java files
    JAVA_COUNT=$(find "$WORKSPACE/$candidate" -name "*.java" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$JAVA_COUNT" -gt 0 ]; then
      if [ -z "$SOURCE_DIRS" ]; then
        SOURCE_DIRS="$candidate"
      else
        SOURCE_DIRS="$SOURCE_DIRS,$candidate"
      fi
      echo "Found source directory: $candidate ($JAVA_COUNT Java files)" >> "$RUN_LOG"
    fi
  fi
done

if [ -z "$SOURCE_DIRS" ]; then
  echo "No Java source directories found" >> "$RUN_LOG"

  # Generate empty report
  cat > "$REPORT_JSON" <<EOF
{
  "analyzer": {"name": "pmd", "version": "$PMD_VERSION"},
  "issues": [],
  "rules": [],
  "error": "No Java source files found"
}
EOF

  cat > "$MEASURES_JSON" <<'EOF'
{"metrics": {"issues_total": 0}}
EOF

  exit 0
fi

echo "Source directories: $SOURCE_DIRS" >> "$RUN_LOG"

# Look for custom PMD config
CONFIG_PATH=""
for candidate in "pmd.xml" ".pmd.xml" "ruleset.xml" ".ruleset.xml"; do
  if [ -f "$WORKSPACE/$candidate" ]; then
    CONFIG_PATH="$WORKSPACE/$candidate"
    echo "Found config: $CONFIG_PATH" >> "$RUN_LOG"
    break
  fi
done

# Build PMD command
PMD_CMD="pmd check"
PMD_CMD="$PMD_CMD -d $SOURCE_DIRS"
PMD_CMD="$PMD_CMD -f xml"
PMD_CMD="$PMD_CMD -r $PMD_XML"
PMD_CMD="$PMD_CMD --no-cache"
PMD_CMD="$PMD_CMD --force-language java"

if [ -n "$CONFIG_PATH" ]; then
  PMD_CMD="$PMD_CMD -R $CONFIG_PATH"
else
  # Use default rulesets for code quality
  # Available categories: bestpractices, codestyle, design, documentation, errorprone, multithreading, performance, security
  PMD_CMD="$PMD_CMD -R category/java/bestpractices.xml,category/java/codestyle.xml,category/java/design.xml,category/java/errorprone.xml,category/java/performance.xml"
fi

echo "Command: $PMD_CMD" >> "$RUN_LOG"

# Run PMD
PMD_STATUS=0
set +e
eval "$PMD_CMD" > "$PMD_STDOUT" 2>&1
PMD_STATUS=$?
set -e

echo "PMD exit code: $PMD_STATUS" >> "$RUN_LOG"

# PMD exit codes:
# 0 = no violations
# 1 = PMD exited with an exception
# 4 = violations found
# 5 = violations found, recoverable errors occurred

if [ $PMD_STATUS -eq 1 ]; then
  echo "ERROR: PMD encountered an error" >> "$RUN_LOG"
  echo "---- PMD output ----" >> "$RUN_LOG"
  cat "$PMD_STDOUT" >> "$RUN_LOG" || true
  echo "--------------------" >> "$RUN_LOG"
fi

# Check if XML was generated
if [ ! -f "$PMD_XML" ]; then
  echo "PMD did not generate XML output, creating empty report" >> "$RUN_LOG"

  # Create minimal XML for parser
  cat > "$PMD_XML" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<pmd version="7.9.0">
</pmd>
EOF
fi

# Parse PMD XML and convert to standard format
ISSUES_COUNT=$(
  PMD_XML="$PMD_XML" \
  REPORT_JSON="$REPORT_JSON" \
  MEASURES_JSON="$MEASURES_JSON" \
  WORKSPACE="$WORKSPACE" \
  PMD_VERSION="$PMD_VERSION" \
  python3 - <<'PYTHON' 2>>"$RUN_LOG"
import hashlib
import json
import os
import sys
import xml.etree.ElementTree as ET

pmd_xml_path = os.environ.get("PMD_XML")
report_path = os.environ.get("REPORT_JSON")
measures_path = os.environ.get("MEASURES_JSON")
workspace = os.environ.get("WORKSPACE", "/workspace")
analyzer_version = os.environ.get("PMD_VERSION", "unknown")

# Parse PMD XML
tree = None
root = None

try:
    tree = ET.parse(pmd_xml_path)
    root = tree.getroot()
except Exception as exc:
    print(f"[parser] Failed to parse PMD XML: {exc}", file=sys.stderr)
    root = None

# Severity mapping
# PMD priority: 1 (high), 2 (medium-high), 3 (medium), 4 (medium-low), 5 (low)
def map_severity(priority: str) -> str:
    """Map PMD priority to severity"""
    try:
        priority_num = int(priority or "3")
    except ValueError:
        priority_num = 3

    if priority_num == 1:
        return "BLOCKER"
    elif priority_num == 2:
        return "CRITICAL"
    elif priority_num == 3:
        return "MAJOR"
    elif priority_num == 4:
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

# Process issues
issues = []
rules_catalog = {}

if root is not None:
    # Handle PMD namespace (if present)
    # Use wildcard namespace matching to work with both namespaced and non-namespaced XML
    for file_elem in root.findall(".//{*}file"):
        file_path_raw = file_elem.get("name", "")
        file_path = normalize_path(file_path_raw)

        # Process each violation in the file
        for violation in file_elem.findall("{*}violation"):
            # Get violation details
            rule = violation.get("rule", "")
            ruleset = violation.get("ruleset", "")
            priority = violation.get("priority", "3")
            message = (violation.text or "").strip()

            # Line and column info
            begin_line = violation.get("beginline")
            end_line = violation.get("endline")
            begin_column = violation.get("begincolumn")
            end_column = violation.get("endcolumn")

            # Build rule key
            if ruleset and rule:
                rule_key = f"pmd:{ruleset}:{rule}"
            elif rule:
                rule_key = f"pmd:{rule}"
            else:
                rule_key = "pmd:unknown"

            severity = map_severity(priority)
            issue_type = "CODE_SMELL"  # PMD primarily finds code quality issues

            # Convert to integers
            line = None
            end_line_num = None
            column = None
            end_column_num = None

            try:
                if begin_line:
                    line = int(begin_line)
                if end_line:
                    end_line_num = int(end_line)
                else:
                    end_line_num = line
                if begin_column:
                    column = int(begin_column)
                if end_column:
                    end_column_num = int(end_column)
            except ValueError:
                pass

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
                "endLine": end_line_num,
                "endColumn": end_column_num,
                "message": message,
                "fingerprint": fingerprint,
            })

            # Collect unique rules
            if rule_key not in rules_catalog:
                rule_name = rule or "Unknown rule"
                rules_catalog[rule_key] = {
                    "key": rule_key,
                    "name": rule_name,
                    "description": message[:200] if message else rule_name,
                    "severity": severity,
                    "type": issue_type,
                }

print(f"[parser] Processed {len(issues)} issues from PMD", file=sys.stderr)
print(f"[parser] Extracted {len(rules_catalog)} unique rules", file=sys.stderr)

# Build report
report_payload = {
    "analyzer": {"name": "pmd", "version": analyzer_version},
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

# Add code_smells_total metric
metrics["code_smells_total"] = type_counts.get("CODE_SMELL", 0)

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

if [ $PMD_STATUS -eq 1 ]; then
  echo "Analyzer completed with errors; results may be partial." >> "$RUN_LOG"
else
  echo "Analyzer completed successfully." >> "$RUN_LOG"
fi
