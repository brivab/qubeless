#!/usr/bin/env bash
set -euo pipefail

OUT_DIR=${OUT_DIR:-/out}
WORKSPACE=${WORKSPACE:-/workspace}

mkdir -p "$OUT_DIR"

SPOTBUGS_XML="$OUT_DIR/spotbugs.xml"
REPORT_JSON="$OUT_DIR/report.json"
MEASURES_JSON="$OUT_DIR/measures.json"
RUN_LOG="$OUT_DIR/run.log"
BUILD_LOG="$OUT_DIR/build.log"

echo "Starting SpotBugs analyzer" > "$RUN_LOG"
echo "Workspace: $WORKSPACE" >> "$RUN_LOG"

# Get SpotBugs version
SPOTBUGS_VERSION=$(spotbugs -version 2>/dev/null | head -n 1 || echo "unknown")
echo "SpotBugs version: $SPOTBUGS_VERSION" >> "$RUN_LOG"

# Copy workspace to a writable temp directory for building
# (workspace is usually mounted read-only)
BUILD_DIR="/tmp/build"
echo "Copying workspace to build directory..." >> "$RUN_LOG"
cp -r "$WORKSPACE" "$BUILD_DIR"
echo "Build directory: $BUILD_DIR" >> "$RUN_LOG"

# Detect build tool
BUILD_TOOL=""
BUILD_CMD=""

cd "$BUILD_DIR"

if [ -f "pom.xml" ]; then
  BUILD_TOOL="maven"
  echo "Detected Maven project (pom.xml found)" >> "$RUN_LOG"
elif [ -f "build.gradle" ] || [ -f "build.gradle.kts" ]; then
  BUILD_TOOL="gradle"
  echo "Detected Gradle project" >> "$RUN_LOG"
else
  echo "ERROR: No build configuration found (pom.xml or build.gradle)" >> "$RUN_LOG"
  echo "SpotBugs requires a Maven or Gradle project to analyze" >> "$RUN_LOG"

  # Generate empty report for failed analysis
  cat > "$REPORT_JSON" <<'EOF'
{
  "analyzer": {"name": "spotbugs", "version": "unknown"},
  "issues": [],
  "rules": [],
  "error": "No Maven or Gradle project detected"
}
EOF

  cat > "$MEASURES_JSON" <<'EOF'
{"metrics": {"issues_total": 0}}
EOF

  exit 1
fi

# Build the project
echo "Building project with $BUILD_TOOL..." >> "$RUN_LOG"

BUILD_STATUS=0
set +e

if [ "$BUILD_TOOL" = "maven" ]; then
  # Maven build, skipping tests
  mvn clean compile -DskipTests -q > "$BUILD_LOG" 2>&1
  BUILD_STATUS=$?

  # Find the compiled classes directory
  CLASSES_DIR="$BUILD_DIR/target/classes"

elif [ "$BUILD_TOOL" = "gradle" ]; then
  # Gradle build, skipping tests
  if [ -f "gradlew" ]; then
    chmod +x gradlew
    ./gradlew clean compileJava -x test --quiet > "$BUILD_LOG" 2>&1
  else
    gradle clean compileJava -x test --quiet > "$BUILD_LOG" 2>&1
  fi
  BUILD_STATUS=$?

  # Find the compiled classes directory (Gradle convention)
  CLASSES_DIR="$BUILD_DIR/build/classes/java/main"
fi

set -e

echo "Build exit code: $BUILD_STATUS" >> "$RUN_LOG"

if [ $BUILD_STATUS -ne 0 ]; then
  echo "ERROR: Build failed" >> "$RUN_LOG"
  echo "---- Build output ----" >> "$RUN_LOG"
  cat "$BUILD_LOG" >> "$RUN_LOG" 2>/dev/null || true
  echo "---------------------" >> "$RUN_LOG"

  # Generate error report
  cat > "$REPORT_JSON" <<EOF
{
  "analyzer": {"name": "spotbugs", "version": "$SPOTBUGS_VERSION"},
  "issues": [],
  "rules": [],
  "error": "Build failed - see run.log for details"
}
EOF

  cat > "$MEASURES_JSON" <<'EOF'
{"metrics": {"issues_total": 0}}
EOF

  exit 1
fi

echo "Build succeeded" >> "$RUN_LOG"

# Check if classes directory exists
if [ ! -d "$CLASSES_DIR" ]; then
  echo "ERROR: Compiled classes directory not found: $CLASSES_DIR" >> "$RUN_LOG"

  # Try to find any classes directory
  FOUND_CLASSES=$(find "$BUILD_DIR" -type d -name "classes" 2>/dev/null | head -n 1)
  if [ -n "$FOUND_CLASSES" ]; then
    CLASSES_DIR="$FOUND_CLASSES"
    echo "Found alternative classes directory: $CLASSES_DIR" >> "$RUN_LOG"
  else
    echo "ERROR: No compiled classes found" >> "$RUN_LOG"

    cat > "$REPORT_JSON" <<EOF
{
  "analyzer": {"name": "spotbugs", "version": "$SPOTBUGS_VERSION"},
  "issues": [],
  "rules": [],
  "error": "No compiled classes found"
}
EOF

    cat > "$MEASURES_JSON" <<'EOF'
{"metrics": {"issues_total": 0}}
EOF

    exit 1
  fi
fi

echo "Analyzing compiled classes in: $CLASSES_DIR" >> "$RUN_LOG"

# Count class files
CLASS_FILES_COUNT=$(find "$CLASSES_DIR" -name "*.class" 2>/dev/null | wc -l | tr -d ' ')
echo "Found $CLASS_FILES_COUNT class file(s)" >> "$RUN_LOG"

if [ "$CLASS_FILES_COUNT" -eq 0 ]; then
  echo "WARNING: No .class files found to analyze" >> "$RUN_LOG"

  cat > "$REPORT_JSON" <<EOF
{
  "analyzer": {"name": "spotbugs", "version": "$SPOTBUGS_VERSION"},
  "issues": [],
  "rules": []
}
EOF

  cat > "$MEASURES_JSON" <<'EOF'
{"metrics": {"issues_total": 0}}
EOF

  exit 0
fi

# Run SpotBugs
echo "Running SpotBugs analysis..." >> "$RUN_LOG"

SPOTBUGS_STATUS=0
set +e

# SpotBugs CLI: -textui for text UI, -xml for XML output, -output for file
/opt/spotbugs/bin/spotbugs -textui \
  -xml:withMessages \
  -output "$SPOTBUGS_XML" \
  -effort:max \
  -low \
  "$CLASSES_DIR" >> "$RUN_LOG" 2>&1

SPOTBUGS_STATUS=$?
set -e

echo "SpotBugs exit code: $SPOTBUGS_STATUS" >> "$RUN_LOG"

# Check if XML was generated
if [ ! -f "$SPOTBUGS_XML" ]; then
  echo "ERROR: SpotBugs did not generate XML output" >> "$RUN_LOG"

  # Create minimal XML for parser
  cat > "$SPOTBUGS_XML" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<BugCollection version="4.8.3">
</BugCollection>
EOF
fi

# Parse SpotBugs XML and convert to standard format
ISSUES_COUNT=$(
  SPOTBUGS_XML="$SPOTBUGS_XML" \
  REPORT_JSON="$REPORT_JSON" \
  MEASURES_JSON="$MEASURES_JSON" \
  WORKSPACE="$WORKSPACE" \
  SPOTBUGS_VERSION="$SPOTBUGS_VERSION" \
  python3 - <<'PYTHON' 2>>"$RUN_LOG"
import hashlib
import json
import os
import sys
import xml.etree.ElementTree as ET

spotbugs_xml_path = os.environ.get("SPOTBUGS_XML")
report_path = os.environ.get("REPORT_JSON")
measures_path = os.environ.get("MEASURES_JSON")
workspace = os.environ.get("WORKSPACE", "/workspace")
analyzer_version = os.environ.get("SPOTBUGS_VERSION", "unknown")

# Parse SpotBugs XML
tree = None
root = None

try:
    tree = ET.parse(spotbugs_xml_path)
    root = tree.getroot()
except Exception as exc:
    print(f"[parser] Failed to parse SpotBugs XML: {exc}", file=sys.stderr)
    root = None

# Severity mapping
# SpotBugs priority: 1 (high), 2 (medium), 3 (low)
def map_severity(priority: str) -> str:
    """Map SpotBugs priority to severity"""
    try:
        priority_num = int(priority or "3")
    except ValueError:
        priority_num = 3

    if priority_num == 1:
        return "CRITICAL"
    elif priority_num == 2:
        return "MAJOR"
    else:
        return "MINOR"

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
    # Build a map of BugPattern for descriptions
    bug_patterns = {}
    for pattern in root.findall(".//BugPattern"):
        pattern_type = pattern.get("type", "")
        short_desc = pattern.find("ShortDescription")
        details = pattern.find("Details")

        bug_patterns[pattern_type] = {
            "shortDescription": short_desc.text if short_desc is not None else "",
            "details": details.text if details is not None else "",
        }

    # Process each BugInstance
    for bug in root.findall(".//BugInstance"):
        bug_type = bug.get("type", "")
        priority = bug.get("priority", "3")
        category = bug.get("category", "")

        # Get message
        long_message_elem = bug.find("LongMessage")
        short_message_elem = bug.find("ShortMessage")

        if long_message_elem is not None and long_message_elem.text:
            message = long_message_elem.text.strip()
        elif short_message_elem is not None and short_message_elem.text:
            message = short_message_elem.text.strip()
        else:
            message = bug_patterns.get(bug_type, {}).get("shortDescription", bug_type)

        # Build rule key
        rule_key = f"spotbugs:{bug_type}" if bug_type else "spotbugs:unknown"

        severity = map_severity(priority)
        issue_type = "BUG"  # SpotBugs finds bugs

        # Get source location
        source_line = bug.find(".//SourceLine[@primary='true']")
        if source_line is None:
            source_line = bug.find(".//SourceLine")

        file_path = ""
        line = None
        end_line = None

        if source_line is not None:
            source_path = source_line.get("sourcepath", "")
            if source_path:
                # SourceLine gives relative path from src, we need to find actual file
                file_path = normalize_path(source_path)

            start_line = source_line.get("start")
            end_line_str = source_line.get("end")

            if start_line:
                try:
                    line = int(start_line)
                    end_line = int(end_line_str) if end_line_str else line
                except ValueError:
                    line = None
                    end_line = None

        # Create stable fingerprint
        fingerprint_source = f"{rule_key}|{file_path}|{line}|{message}"
        fingerprint = hashlib.sha256(fingerprint_source.encode("utf-8")).hexdigest()

        issues.append({
            "ruleKey": rule_key,
            "severity": severity,
            "type": issue_type,
            "filePath": file_path,
            "line": line,
            "column": 1,
            "endLine": end_line,
            "endColumn": 1,
            "message": message,
            "fingerprint": fingerprint,
        })

        # Collect unique rules
        if rule_key not in rules_catalog:
            pattern_info = bug_patterns.get(bug_type, {})
            rules_catalog[rule_key] = {
                "key": rule_key,
                "name": bug_type or "Unknown bug",
                "description": pattern_info.get("shortDescription", message)[:200],
                "severity": severity,
                "type": issue_type,
            }

print(f"[parser] Processed {len(issues)} bugs from SpotBugs", file=sys.stderr)
print(f"[parser] Extracted {len(rules_catalog)} unique rules", file=sys.stderr)

# Build report
report_payload = {
    "analyzer": {"name": "spotbugs", "version": analyzer_version},
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

# Add bugs_total metric
metrics["bugs_total"] = len(issues)

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
echo "Classes analyzed: $CLASS_FILES_COUNT" >> "$RUN_LOG"

if [ $SPOTBUGS_STATUS -ne 0 ]; then
  echo "SpotBugs completed with warnings; results may be partial." >> "$RUN_LOG"
else
  echo "Analyzer completed successfully." >> "$RUN_LOG"
fi
