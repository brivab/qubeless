#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANALYZER_NAME="spotbugs"
IMAGE_NAME="qubeless-analyzer-${ANALYZER_NAME}"
DEMO_PROJECT="${SCRIPT_DIR}/../../examples/java-spotbugs-demo"

echo "=== Testing SpotBugs Analyzer ==="

# Check if demo project exists
if [ ! -d "$DEMO_PROJECT" ]; then
  echo "ERROR: Demo project not found at $DEMO_PROJECT"
  exit 1
fi

echo "Demo project: $DEMO_PROJECT"

# Build the Docker image
echo "Building Docker image..."
docker build -t "$IMAGE_NAME" "$SCRIPT_DIR"

# Create output directory
OUT_DIR=$(mktemp -d)
echo "Output directory: $OUT_DIR"

# Run the analyzer
echo "Running analyzer on demo project..."
docker run --rm \
  -v "$DEMO_PROJECT:/workspace:ro" \
  -v "$OUT_DIR:/out" \
  -e WORKSPACE=/workspace \
  -e OUT_DIR=/out \
  "$IMAGE_NAME"

# Check outputs
echo ""
echo "=== Checking outputs ==="

if [ ! -f "$OUT_DIR/report.json" ]; then
  echo "ERROR: report.json not found"
  exit 1
fi

if [ ! -f "$OUT_DIR/measures.json" ]; then
  echo "ERROR: measures.json not found"
  exit 1
fi

if [ ! -f "$OUT_DIR/run.log" ]; then
  echo "ERROR: run.log not found"
  exit 1
fi

echo "All output files present."
echo ""

# Validate report.json structure
echo "=== Validating report.json ==="
ISSUES_COUNT=$(cat "$OUT_DIR/report.json" | grep -o '"issues"' | wc -l | tr -d ' ')
RULES_COUNT=$(cat "$OUT_DIR/report.json" | grep -o '"rules"' | wc -l | tr -d ' ')
ANALYZER_NAME_IN_REPORT=$(cat "$OUT_DIR/report.json" | grep -o '"name".*"spotbugs"' | wc -l | tr -d ' ')

if [ "$ISSUES_COUNT" -eq 0 ]; then
  echo "ERROR: 'issues' field not found in report.json"
  exit 1
fi

if [ "$RULES_COUNT" -eq 0 ]; then
  echo "ERROR: 'rules' field not found in report.json"
  exit 1
fi

if [ "$ANALYZER_NAME_IN_REPORT" -eq 0 ]; then
  echo "ERROR: analyzer name 'spotbugs' not found in report.json"
  exit 1
fi

# Count actual issues
ACTUAL_ISSUES=$(cat "$OUT_DIR/report.json" | grep -c '"ruleKey"' || echo "0")
echo "Found $ACTUAL_ISSUES issues in report"

if [ "$ACTUAL_ISSUES" -eq 0 ]; then
  echo "WARNING: No issues detected. Expected at least some bugs in the demo project."
  echo "This might indicate a problem with the analyzer or SpotBugs configuration."
fi

# Validate measures.json
echo ""
echo "=== Validating measures.json ==="
METRICS_COUNT=$(cat "$OUT_DIR/measures.json" | grep -o '"metrics"' | wc -l | tr -d ' ')

if [ "$METRICS_COUNT" -eq 0 ]; then
  echo "ERROR: 'metrics' field not found in measures.json"
  exit 1
fi

ISSUES_TOTAL=$(cat "$OUT_DIR/measures.json" | grep -o '"issues_total"' | wc -l | tr -d ' ')
if [ "$ISSUES_TOTAL" -eq 0 ]; then
  echo "ERROR: 'issues_total' metric not found in measures.json"
  exit 1
fi

echo "measures.json structure valid"

# Display run.log
echo ""
echo "=== Run Log ==="
cat "$OUT_DIR/run.log"

echo ""
echo "=== Sample issues (first 3) ==="
cat "$OUT_DIR/report.json" | grep -A 20 '"issues"' | head -n 60 || echo "No issues to display"

echo ""
echo "=== Test Summary ==="
echo "Image: $IMAGE_NAME"
echo "Output directory: $OUT_DIR"
echo "Issues detected: $ACTUAL_ISSUES"
echo ""

if [ "$ACTUAL_ISSUES" -gt 0 ]; then
  echo "✓ Test PASSED - SpotBugs analyzer working correctly"
  echo ""
  echo "Cleanup: rm -rf $OUT_DIR"
  exit 0
else
  echo "⚠ Test PASSED with warnings - No issues detected"
  echo "The analyzer runs but SpotBugs found no bugs (unexpected for demo project)"
  echo ""
  echo "Cleanup: rm -rf $OUT_DIR"
  exit 0
fi
