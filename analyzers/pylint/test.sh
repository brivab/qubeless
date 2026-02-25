#!/usr/bin/env bash
set -euo pipefail

# Test script for Pylint analyzer
# This script builds the Docker image and runs it against the demo project

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEMO_DIR="$PROJECT_ROOT/examples/python-pylint-demo"
OUT_DIR="$SCRIPT_DIR/test-output"

IMAGE_NAME="pylint-analyzer"
IMAGE_TAG="latest"

echo "=== Pylint Analyzer Test ==="
echo ""

# Clean previous output
if [ -d "$OUT_DIR" ]; then
  echo "Cleaning previous test output..."
  rm -rf "$OUT_DIR"
fi
mkdir -p "$OUT_DIR"

# Build Docker image
echo "Building Docker image..."
docker build -t "$IMAGE_NAME:$IMAGE_TAG" "$SCRIPT_DIR"
echo "✓ Image built successfully"
echo ""

# Check if demo project exists
if [ ! -d "$DEMO_DIR" ]; then
  echo "❌ Demo project not found at $DEMO_DIR"
  exit 1
fi

echo "Running analyzer on demo project..."
echo "  Workspace: $DEMO_DIR"
echo "  Output: $OUT_DIR"
echo ""

# Run analyzer
docker run --rm \
  -v "$DEMO_DIR:/workspace:ro" \
  -v "$OUT_DIR:/out" \
  "$IMAGE_NAME:$IMAGE_TAG"

echo ""
echo "=== Test Results ==="
echo ""

# Verify output files exist
REPORT_JSON="$OUT_DIR/report.json"
MEASURES_JSON="$OUT_DIR/measures.json"
RUN_LOG="$OUT_DIR/run.log"

EXIT_CODE=0

if [ ! -f "$REPORT_JSON" ]; then
  echo "❌ report.json not found"
  EXIT_CODE=1
else
  echo "✓ report.json exists"
fi

if [ ! -f "$MEASURES_JSON" ]; then
  echo "❌ measures.json not found"
  EXIT_CODE=1
else
  echo "✓ measures.json exists"
fi

if [ ! -f "$RUN_LOG" ]; then
  echo "❌ run.log not found"
  EXIT_CODE=1
else
  echo "✓ run.log exists"
fi

echo ""

# Verify JSON is parseable
if [ -f "$REPORT_JSON" ]; then
  if python3 -c "import json; json.load(open('$REPORT_JSON'))" 2>/dev/null; then
    echo "✓ report.json is valid JSON"
  else
    echo "❌ report.json is not valid JSON"
    EXIT_CODE=1
  fi
fi

if [ -f "$MEASURES_JSON" ]; then
  if python3 -c "import json; json.load(open('$MEASURES_JSON'))" 2>/dev/null; then
    echo "✓ measures.json is valid JSON"
  else
    echo "❌ measures.json is not valid JSON"
    EXIT_CODE=1
  fi
fi

echo ""

# Check for issues in report
if [ -f "$REPORT_JSON" ]; then
  ISSUES_COUNT=$(python3 -c "import json; print(len(json.load(open('$REPORT_JSON'))['issues']))" 2>/dev/null || echo "0")
  echo "Issues found: $ISSUES_COUNT"

  if [ "$ISSUES_COUNT" -gt 0 ]; then
    echo "✓ At least one issue detected"
  else
    echo "⚠️  No issues detected (expected at least one from demo project)"
  fi
fi

echo ""

# Display sample of findings
if [ -f "$REPORT_JSON" ] && [ "$ISSUES_COUNT" -gt 0 ]; then
  echo "Sample issues (first 3):"
  REPORT_JSON="$REPORT_JSON" python3 - <<'PYTHON'
import json
import os
report_path = os.environ.get('REPORT_JSON')
with open(report_path) as f:
    data = json.load(f)
    for i, issue in enumerate(data['issues'][:3], 1):
        print(f"  {i}. [{issue['severity']}] {issue['ruleKey']}")
        print(f"     {issue['filePath']}:{issue['line']}")
        print(f"     {issue['message'][:80]}")
        print()
PYTHON
fi

# Display run log summary
if [ -f "$RUN_LOG" ]; then
  echo "Run log summary:"
  echo "----------------"
  cat "$RUN_LOG"
  echo "----------------"
fi

echo ""

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ All tests passed!"
else
  echo "❌ Some tests failed"
fi

exit $EXIT_CODE
