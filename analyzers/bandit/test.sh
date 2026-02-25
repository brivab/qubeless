#!/usr/bin/env bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=================================="
echo "Bandit Analyzer Test Script"
echo "=================================="

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANALYZER_DIR="$SCRIPT_DIR"
EXAMPLES_DIR="$(cd "$SCRIPT_DIR/../../examples/python-bandit-demo" && pwd)"
OUT_DIR="$SCRIPT_DIR/test-output"

# Clean previous output
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

echo ""
echo "Step 1: Building Docker image..."
echo "-----------------------------------"
cd "$ANALYZER_DIR"
if docker build -t bandit-analyzer:latest .; then
    echo -e "${GREEN}✓ Docker build successful${NC}"
else
    echo -e "${RED}✗ Docker build failed${NC}"
    exit 1
fi

echo ""
echo "Step 2: Running analyzer on demo project..."
echo "-----------------------------------"
echo "Workspace: $EXAMPLES_DIR"
echo "Output: $OUT_DIR"

if docker run --rm \
    -v "$EXAMPLES_DIR:/workspace:ro" \
    -v "$OUT_DIR:/out" \
    bandit-analyzer:latest; then
    echo -e "${GREEN}✓ Analyzer execution successful${NC}"
else
    echo -e "${YELLOW}⚠ Analyzer completed (exit code $?)${NC}"
fi

echo ""
echo "Step 3: Validating output files..."
echo "-----------------------------------"

REQUIRED_FILES=("report.json" "measures.json" "run.log")
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$OUT_DIR/$file" ]; then
        echo -e "${GREEN}✓ Found $file${NC}"
    else
        echo -e "${RED}✗ Missing $file${NC}"
        exit 1
    fi
done

echo ""
echo "Step 4: Validating report.json structure..."
echo "-----------------------------------"

# Check if report.json is valid JSON
if jq empty "$OUT_DIR/report.json" 2>/dev/null; then
    echo -e "${GREEN}✓ report.json is valid JSON${NC}"
else
    echo -e "${RED}✗ report.json is not valid JSON${NC}"
    exit 1
fi

# Extract key information
ANALYZER_NAME=$(jq -r '.analyzer.name' "$OUT_DIR/report.json")
ANALYZER_VERSION=$(jq -r '.analyzer.version' "$OUT_DIR/report.json")
ISSUES_COUNT=$(jq '.issues | length' "$OUT_DIR/report.json")
RULES_COUNT=$(jq '.rules | length' "$OUT_DIR/report.json")

echo "Analyzer: $ANALYZER_NAME v$ANALYZER_VERSION"
echo "Issues found: $ISSUES_COUNT"
echo "Rules detected: $RULES_COUNT"

# Validate analyzer name
if [ "$ANALYZER_NAME" = "bandit" ]; then
    echo -e "${GREEN}✓ Analyzer name is correct${NC}"
else
    echo -e "${RED}✗ Analyzer name is incorrect: $ANALYZER_NAME${NC}"
    exit 1
fi

# Validate issues count (should have at least 1 vulnerability in demo)
if [ "$ISSUES_COUNT" -ge 1 ]; then
    echo -e "${GREEN}✓ Found vulnerabilities in demo project${NC}"
else
    echo -e "${RED}✗ No vulnerabilities found (expected at least 1)${NC}"
    exit 1
fi

echo ""
echo "Step 5: Validating issue structure..."
echo "-----------------------------------"

# Check first issue structure
FIRST_ISSUE=$(jq '.issues[0]' "$OUT_DIR/report.json")
REQUIRED_FIELDS=("ruleKey" "severity" "type" "filePath" "line" "message" "fingerprint")

for field in "${REQUIRED_FIELDS[@]}"; do
    VALUE=$(echo "$FIRST_ISSUE" | jq -r ".$field")
    if [ -n "$VALUE" ] && [ "$VALUE" != "null" ]; then
        echo -e "${GREEN}✓ Field '$field' is present${NC}"
    else
        echo -e "${RED}✗ Field '$field' is missing or null${NC}"
        exit 1
    fi
done

# Validate issue type is VULNERABILITY
ISSUE_TYPE=$(echo "$FIRST_ISSUE" | jq -r '.type')
if [ "$ISSUE_TYPE" = "VULNERABILITY" ]; then
    echo -e "${GREEN}✓ Issue type is VULNERABILITY${NC}"
else
    echo -e "${RED}✗ Issue type is not VULNERABILITY: $ISSUE_TYPE${NC}"
    exit 1
fi

# Validate ruleKey format (should be bandit:*)
RULE_KEY=$(echo "$FIRST_ISSUE" | jq -r '.ruleKey')
if [[ "$RULE_KEY" =~ ^bandit: ]]; then
    echo -e "${GREEN}✓ Rule key format is correct: $RULE_KEY${NC}"
else
    echo -e "${RED}✗ Rule key format is incorrect: $RULE_KEY${NC}"
    exit 1
fi

echo ""
echo "Step 6: Validating measures.json..."
echo "-----------------------------------"

# Check if measures.json is valid JSON
if jq empty "$OUT_DIR/measures.json" 2>/dev/null; then
    echo -e "${GREEN}✓ measures.json is valid JSON${NC}"
else
    echo -e "${RED}✗ measures.json is not valid JSON${NC}"
    exit 1
fi

# Extract metrics
TOTAL_ISSUES=$(jq -r '.metrics.issues_total' "$OUT_DIR/measures.json")
VULN_TOTAL=$(jq -r '.metrics.vulnerabilities_total' "$OUT_DIR/measures.json")
VULN_BY_TYPE=$(jq -r '.metrics."issues_by_type.vulnerability"' "$OUT_DIR/measures.json")

echo "Total issues: $TOTAL_ISSUES"
echo "Vulnerabilities: $VULN_TOTAL"

# Validate vulnerabilities_total metric
if [ "$VULN_TOTAL" -ge 1 ]; then
    echo -e "${GREEN}✓ vulnerabilities_total metric is present and > 0${NC}"
else
    echo -e "${RED}✗ vulnerabilities_total metric is missing or 0${NC}"
    exit 1
fi

# Validate all issues are vulnerabilities
if [ "$TOTAL_ISSUES" = "$VULN_BY_TYPE" ]; then
    echo -e "${GREEN}✓ All issues are typed as VULNERABILITY${NC}"
else
    echo -e "${RED}✗ Not all issues are typed as VULNERABILITY${NC}"
    exit 1
fi

echo ""
echo "Step 7: Sample issues found..."
echo "-----------------------------------"

# Display first 3 issues
jq -r '.issues[0:3] | .[] | "- [\(.severity)] \(.ruleKey): \(.message) (\(.filePath):\(.line))"' "$OUT_DIR/report.json"

echo ""
echo "Step 8: Severity breakdown..."
echo "-----------------------------------"

jq -r '.metrics | to_entries | map(select(.key | startswith("issues_by_severity."))) | .[] | "\(.key): \(.value)"' "$OUT_DIR/measures.json"

echo ""
echo "=================================="
echo -e "${GREEN}✓ All tests passed!${NC}"
echo "=================================="
echo ""
echo "Output files are in: $OUT_DIR"
echo "- report.json: Full analysis report"
echo "- measures.json: Metrics summary"
echo "- run.log: Execution log"
echo "- bandit.json: Raw Bandit output"
