#!/usr/bin/env bash
set -euo pipefail

OUT_DIR=${OUT_DIR:-/out}
WORKSPACE=${WORKSPACE:-/workspace}

mkdir -p "$OUT_DIR"

JSCPD_JSON="$OUT_DIR/jscpd.json"
REPORT_JSON="$OUT_DIR/report.json"
MEASURES_JSON="$OUT_DIR/measures.json"
RUN_LOG="$OUT_DIR/run.log"
JSCPD_STDOUT="$OUT_DIR/jscpd.log"

echo "Starting jscpd analyzer" > "$RUN_LOG"
echo "Workspace: $WORKSPACE" >> "$RUN_LOG"

# Get jscpd version
JSCPD_VERSION=$(jscpd --version 2>/dev/null | head -n 1 || echo "unknown")
if [ -z "$JSCPD_VERSION" ]; then
  JSCPD_VERSION="unknown"
fi

echo "jscpd version: $JSCPD_VERSION" >> "$RUN_LOG"

# Configuration options
MIN_LINES=${JSCPD_MIN_LINES:-5}
MIN_TOKENS=${JSCPD_MIN_TOKENS:-50}

echo "Min lines: $MIN_LINES" >> "$RUN_LOG"
echo "Min tokens: $MIN_TOKENS" >> "$RUN_LOG"

# Build exclusion patterns
IGNORE_PATTERNS=(
  "node_modules/**"
  "dist/**"
  "build/**"
  ".git/**"
  "coverage/**"
  ".venv/**"
  "venv/**"
  "target/**"
  "__pycache__/**"
  "*.min.js"
  "*.bundle.js"
)

# Build ignore arguments
IGNORE_ARGS=""
for pattern in "${IGNORE_PATTERNS[@]}"; do
  IGNORE_ARGS="$IGNORE_ARGS --ignore '$pattern'"
done

echo "Running jscpd duplication detection..." >> "$RUN_LOG"

# Create report directory in a writable location (not in read-only workspace)
JSCPD_REPORT_DIR="/tmp/jscpd-report"
mkdir -p "$JSCPD_REPORT_DIR"

# Build the command - scan all subdirectories recursively
# Use absolute path for output to avoid writing to read-only workspace
CMD="cd $WORKSPACE && jscpd . --min-lines $MIN_LINES --min-tokens $MIN_TOKENS $IGNORE_ARGS --reporters json --output $JSCPD_REPORT_DIR"

echo "Command: $CMD" >> "$RUN_LOG"

# Run jscpd
set +e
eval "$CMD" > "$JSCPD_STDOUT" 2>&1
JSCPD_STATUS=$?
set -e

echo "jscpd exit code: $JSCPD_STATUS" >> "$RUN_LOG"

if [ $JSCPD_STATUS -ne 0 ]; then
  echo "jscpd encountered errors" >> "$RUN_LOG"
  echo "---- jscpd output ----" >> "$RUN_LOG"
  cat "$JSCPD_STDOUT" >> "$RUN_LOG" || true
  echo "----------------------" >> "$RUN_LOG"
fi

# jscpd creates its JSON output in the temp directory
JSCPD_OUTPUT="$JSCPD_REPORT_DIR/jscpd-report.json"
if [ ! -f "$JSCPD_OUTPUT" ]; then
  echo "jscpd report not found at $JSCPD_OUTPUT, creating empty result" >> "$RUN_LOG"
  echo '{"duplicates": [], "statistics": {"total": {"percentage": 0, "sources": 0, "clones": 0, "duplicatedLines": 0}}}' > "$JSCPD_JSON"
else
  echo "Found jscpd output at: $JSCPD_OUTPUT" >> "$RUN_LOG"
  # Copy to expected location
  cp "$JSCPD_OUTPUT" "$JSCPD_JSON"
fi

# Parse jscpd JSON and convert to standard format
BLOCKS_COUNT=$(
  JSCPD_JSON="$JSCPD_JSON" \
  REPORT_JSON="$REPORT_JSON" \
  MEASURES_JSON="$MEASURES_JSON" \
  WORKSPACE="$WORKSPACE" \
  JSCPD_VERSION="$JSCPD_VERSION" \
  python3 - <<'PYTHON' 2>>"$RUN_LOG"
import hashlib
import json
import os
import sys

jscpd_json_path = os.environ.get("JSCPD_JSON")
report_path = os.environ.get("REPORT_JSON")
measures_path = os.environ.get("MEASURES_JSON")
workspace = os.environ.get("WORKSPACE", "/workspace")
analyzer_version = os.environ.get("JSCPD_VERSION", "unknown")

# Read jscpd JSON output
data = {}
duplicates = []
statistics = {}

if jscpd_json_path and os.path.isfile(jscpd_json_path):
    try:
        with open(jscpd_json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        duplicates = data.get("duplicates", [])
        statistics = data.get("statistics", {})
    except Exception as exc:
        print(f"[parser] failed to parse jscpd JSON: {exc}", file=sys.stderr)
        duplicates = []
        statistics = {}
else:
    print(f"[parser] jscpd JSON not found: {jscpd_json_path}", file=sys.stderr)

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

# Process duplication blocks
blocks = []

for dup in duplicates:
    first_file = dup.get("firstFile", {})
    second_file = dup.get("secondFile", {})

    file1_path = normalize_path(first_file.get("name", ""))
    file1_start = first_file.get("start", 0)
    file1_end = first_file.get("end", 0)

    file2_path = normalize_path(second_file.get("name", ""))
    file2_start = second_file.get("start", 0)
    file2_end = second_file.get("end", 0)

    lines = dup.get("lines", 0)
    tokens = dup.get("tokens", 0)

    # Create fingerprint for the duplication block
    fingerprint_source = f"jscpd|{file1_path}|{file1_start}|{file2_path}|{file2_start}"
    fingerprint = hashlib.sha256(fingerprint_source.encode("utf-8")).hexdigest()

    blocks.append({
        "file1Path": file1_path,
        "file1StartLine": file1_start,
        "file1EndLine": file1_end,
        "file2Path": file2_path,
        "file2StartLine": file2_start,
        "file2EndLine": file2_end,
        "lines": lines,
        "tokens": tokens,
        "fingerprint": fingerprint
    })

print(f"[parser] Processed {len(blocks)} duplication blocks from jscpd", file=sys.stderr)

# Extract statistics
total_stats = statistics.get("total", {})
duplication_percent = float(total_stats.get("percentage", 0))
duplicated_lines = int(total_stats.get("duplicatedLines", 0))
total_sources = int(total_stats.get("sources", 0))
total_clones = int(total_stats.get("clones", 0))

# Build report
report_payload = {
    "analyzer": {"name": "jscpd", "version": analyzer_version},
    "blocks": blocks,
    "statistics": {
        "duplicationPercent": duplication_percent,
        "duplicatedLines": duplicated_lines,
        "totalSources": total_sources,
        "totalClones": total_clones
    }
}

with open(report_path, "w", encoding="utf-8") as f:
    json.dump(report_payload, f, indent=2)

# Calculate metrics
metrics = {
    "duplication_percent": duplication_percent,
    "duplication_blocks": len(blocks),
    "duplicated_lines": duplicated_lines,
    "total_sources": total_sources,
    "total_clones": total_clones
}

with open(measures_path, "w", encoding="utf-8") as f:
    json.dump({"metrics": metrics}, f, indent=2)

# Output block count for shell script
print(len(blocks))
PYTHON
)

if [ -z "$BLOCKS_COUNT" ]; then
  BLOCKS_COUNT=0
fi

echo "Duplication blocks in report: $BLOCKS_COUNT" >> "$RUN_LOG"

if [ $JSCPD_STATUS -ne 0 ]; then
  echo "Analyzer completed with errors; results may be partial." >> "$RUN_LOG"
else
  echo "Analyzer completed successfully." >> "$RUN_LOG"
fi
