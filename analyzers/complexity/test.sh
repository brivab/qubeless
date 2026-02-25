#!/usr/bin/env bash
set -euo pipefail

# Test script for complexity analyzer

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ANALYZER_NAME="complexity"
IMAGE_NAME="qubeless/analyzer-${ANALYZER_NAME}:latest"

echo "==================================="
echo "Testing Complexity Analyzer"
echo "==================================="
echo ""

# Build the Docker image
echo "Building Docker image..."
docker build -t "$IMAGE_NAME" "$SCRIPT_DIR"
echo ""

# Test with the complexity demo project
DEMO_DIR="$PROJECT_ROOT/examples/complexity-demo"

if [ ! -d "$DEMO_DIR" ]; then
  echo "Error: Demo directory not found at $DEMO_DIR"
  exit 1
fi

echo "Running analyzer on demo project..."
echo "Demo directory: $DEMO_DIR"
echo ""

# Create output directory
OUT_DIR="/tmp/qubeless-complexity-test-$(date +%s)"
mkdir -p "$OUT_DIR"

echo "Output directory: $OUT_DIR"
echo ""

# Run the analyzer
docker run --rm \
  -v "$DEMO_DIR:/workspace:ro" \
  -v "$OUT_DIR:/out" \
  -e COMPLEXITY_THRESHOLD=10 \
  -e COMPLEXITY_SEVERITY_MINOR_FROM=11 \
  -e COMPLEXITY_SEVERITY_MAJOR_FROM=16 \
  -e COMPLEXITY_SEVERITY_CRITICAL_FROM=26 \
  "$IMAGE_NAME"

echo ""
echo "==================================="
echo "Analyzer Output"
echo "==================================="
echo ""

# Check output files
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

echo "--- run.log ---"
cat "$OUT_DIR/run.log"
echo ""

echo "--- measures.json ---"
cat "$OUT_DIR/measures.json" | python3 -m json.tool
echo ""

echo "--- report.json (summary) ---"
echo "Analyzer: $(cat "$OUT_DIR/report.json" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['analyzer'])")"
echo "Issues count: $(cat "$OUT_DIR/report.json" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data['issues']))")"
echo ""

# Display sample issues
echo "--- Sample Issues ---"
cat "$OUT_DIR/report.json" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for issue in data['issues'][:5]:
    print(f\"{issue['severity']:8} {issue['filePath']}:{issue['line']} - {issue['message']}\")
if len(data['issues']) > 5:
    print(f\"... and {len(data['issues']) - 5} more issues\")
"
echo ""

echo "==================================="
echo "Test completed successfully!"
echo "==================================="
echo ""
echo "Output files saved in: $OUT_DIR"

# Optionally clean up
# rm -rf "$OUT_DIR"
