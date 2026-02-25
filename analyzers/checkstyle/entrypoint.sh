#!/usr/bin/env bash
set -euo pipefail

OUT_DIR=${OUT_DIR:-/out}
WORKSPACE=${WORKSPACE:-/workspace}

mkdir -p "$OUT_DIR"

CHECKSTYLE_XML="$OUT_DIR/checkstyle.xml"
REPORT_JSON="$OUT_DIR/report.json"
MEASURES_JSON="$OUT_DIR/measures.json"
RUN_LOG="$OUT_DIR/run.log"
CHECKSTYLE_STDOUT="$OUT_DIR/checkstyle.log"

echo "Starting Checkstyle analyzer" > "$RUN_LOG"
echo "Workspace: $WORKSPACE" >> "$RUN_LOG"

# Get Checkstyle version
CHECKSTYLE_VERSION=$(java -jar /opt/checkstyle.jar --version 2>/dev/null | grep -oP '\d+\.\d+\.\d+' | head -n 1 || echo "unknown")
echo "Checkstyle version: $CHECKSTYLE_VERSION" >> "$RUN_LOG"

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
        SOURCE_DIRS="$SOURCE_DIRS $candidate"
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
  "analyzer": {"name": "checkstyle", "version": "$CHECKSTYLE_VERSION"},
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

# Look for custom Checkstyle config (priority order)
CONFIG_PATH=""
for candidate in "checkstyle.xml" "config/checkstyle/checkstyle.xml" ".checkstyle.xml"; do
  if [ -f "$WORKSPACE/$candidate" ]; then
    CONFIG_PATH="$WORKSPACE/$candidate"
    echo "Found config: $CONFIG_PATH" >> "$RUN_LOG"
    break
  fi
done

if [ -z "$CONFIG_PATH" ]; then
  # Use default Google Java Style configuration
  CONFIG_PATH="/app/google_checks.xml"
  echo "Using default Google Java Style configuration" >> "$RUN_LOG"
fi

# Build list of Java files to scan
JAVA_FILES=$(find $SOURCE_DIRS -name "*.java" 2>/dev/null | tr '\n' ' ')

if [ -z "$JAVA_FILES" ]; then
  echo "No Java files found to scan" >> "$RUN_LOG"

  # Generate empty report
  cat > "$REPORT_JSON" <<EOF
{
  "analyzer": {"name": "checkstyle", "version": "$CHECKSTYLE_VERSION"},
  "issues": [],
  "rules": []
}
EOF

  cat > "$MEASURES_JSON" <<'EOF'
{"metrics": {"issues_total": 0}}
EOF

  exit 0
fi

# Build Checkstyle command
CHECKSTYLE_CMD="checkstyle -c $CONFIG_PATH -f xml -o $CHECKSTYLE_XML $JAVA_FILES"

echo "Command: $CHECKSTYLE_CMD" >> "$RUN_LOG"

# Run Checkstyle
CHECKSTYLE_STATUS=0
set +e
eval "$CHECKSTYLE_CMD" > "$CHECKSTYLE_STDOUT" 2>&1
CHECKSTYLE_STATUS=$?
set -e

echo "Checkstyle exit code: $CHECKSTYLE_STATUS" >> "$RUN_LOG"

# Checkstyle exit codes:
# 0 = no violations
# 1 = violations found or configuration errors
# 2 = command line usage error

if [ $CHECKSTYLE_STATUS -eq 2 ]; then
  echo "ERROR: Checkstyle command line error" >> "$RUN_LOG"
  echo "---- Checkstyle output ----" >> "$RUN_LOG"
  cat "$CHECKSTYLE_STDOUT" >> "$RUN_LOG" || true
  echo "--------------------" >> "$RUN_LOG"
fi

# Check if XML was generated
if [ ! -f "$CHECKSTYLE_XML" ]; then
  echo "Checkstyle did not generate XML output, creating empty report" >> "$RUN_LOG"

  # Create minimal XML for parser
  cat > "$CHECKSTYLE_XML" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<checkstyle version="10.21.1">
</checkstyle>
EOF
fi

# Parse Checkstyle XML and convert to standard format
ISSUES_COUNT=$(
  CHECKSTYLE_XML="$CHECKSTYLE_XML" \
  REPORT_JSON="$REPORT_JSON" \
  MEASURES_JSON="$MEASURES_JSON" \
  WORKSPACE="$WORKSPACE" \
  CHECKSTYLE_VERSION="$CHECKSTYLE_VERSION" \
  python3 - <<'PYTHON' 2>>"$RUN_LOG"
import hashlib
import json
import os
import sys
import xml.etree.ElementTree as ET

checkstyle_xml_path = os.environ.get("CHECKSTYLE_XML")
report_path = os.environ.get("REPORT_JSON")
measures_path = os.environ.get("MEASURES_JSON")
workspace = os.environ.get("WORKSPACE", "/workspace")
analyzer_version = os.environ.get("CHECKSTYLE_VERSION", "unknown")

# Parse Checkstyle XML
tree = None
root = None

try:
    tree = ET.parse(checkstyle_xml_path)
    root = tree.getroot()
except Exception as exc:
    print(f"[parser] Failed to parse Checkstyle XML: {exc}", file=sys.stderr)
    root = None

# Severity mapping for Checkstyle
# Checkstyle has: error, warning, info
# Most checks are configurable at the module level
# We'll use MINOR by default and map specific critical modules to MAJOR
CRITICAL_MODULES = {
    "NullPointerException",
    "ArrayIndexOutOfBounds",
    "EmptyStatement",
    "MissingSwitchDefault",
    "FallThrough",
    "IllegalCatch",
    "IllegalThrows",
    "InnerAssignment",
    "MagicNumber",
    "SimplifyBooleanExpression",
    "SimplifyBooleanReturn",
}

def map_severity(severity: str, module_name: str) -> str:
    """Map Checkstyle severity to our severity levels"""
    severity_lower = (severity or "warning").lower()

    # Check if this is a critical module
    if module_name in CRITICAL_MODULES:
        return "MAJOR"

    # Otherwise map based on Checkstyle severity
    if severity_lower == "error":
        return "MAJOR"
    elif severity_lower == "warning":
        return "MINOR"
    else:  # info
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
    # Checkstyle XML structure: <checkstyle><file><error/></file></checkstyle>
    for file_elem in root.findall("file"):
        file_path_raw = file_elem.get("name", "")
        file_path = normalize_path(file_path_raw)

        # Process each error in the file
        for error in file_elem.findall("error"):
            # Get error details
            line = error.get("line")
            column = error.get("column")
            severity = error.get("severity", "warning")
            message = error.get("message", "")
            source = error.get("source", "")  # Full class name like com.puppycrawl.tools.checkstyle.checks.coding.MagicNumberCheck

            # Extract module name from source
            # Example: com.puppycrawl.tools.checkstyle.checks.coding.MagicNumberCheck -> MagicNumberCheck
            module_name = ""
            if source:
                parts = source.split(".")
                if parts:
                    module_name = parts[-1]
                    # Remove "Check" suffix if present
                    if module_name.endswith("Check"):
                        module_name = module_name[:-5]

            # Build rule key
            if module_name:
                rule_key = f"checkstyle:{module_name}"
            else:
                rule_key = "checkstyle:unknown"

            mapped_severity = map_severity(severity, module_name)
            issue_type = "CODE_SMELL"  # Checkstyle primarily finds style issues

            # Convert to integers
            line_num = None
            column_num = None

            try:
                if line:
                    line_num = int(line)
                if column:
                    column_num = int(column)
            except ValueError:
                pass

            # Create stable fingerprint
            fingerprint_source = f"{rule_key}|{file_path}|{line_num}|{message}"
            fingerprint = hashlib.sha256(fingerprint_source.encode("utf-8")).hexdigest()

            issues.append({
                "ruleKey": rule_key,
                "severity": mapped_severity,
                "type": issue_type,
                "filePath": file_path,
                "line": line_num,
                "column": column_num,
                "endLine": line_num,
                "endColumn": column_num,
                "message": message,
                "fingerprint": fingerprint,
            })

            # Collect unique rules
            if rule_key not in rules_catalog:
                rule_name = module_name or "Unknown rule"
                rules_catalog[rule_key] = {
                    "key": rule_key,
                    "name": rule_name,
                    "description": message[:200] if message else rule_name,
                    "severity": mapped_severity,
                    "type": issue_type,
                }

print(f"[parser] Processed {len(issues)} issues from Checkstyle", file=sys.stderr)
print(f"[parser] Extracted {len(rules_catalog)} unique rules", file=sys.stderr)

# Build report
report_payload = {
    "analyzer": {"name": "checkstyle", "version": analyzer_version},
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

if [ $CHECKSTYLE_STATUS -eq 2 ]; then
  echo "Analyzer completed with errors; results may be partial." >> "$RUN_LOG"
else
  echo "Analyzer completed successfully." >> "$RUN_LOG"
fi
