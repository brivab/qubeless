#!/bin/bash
set -e

echo "🔍 Auditing dependencies for vulnerabilities..."

# Audit root
echo "📦 Root workspace..."
pnpm audit --audit-level=moderate || true

# Audit each workspace
for dir in apps/api apps/web apps/worker packages/shared packages/scanner; do
  if [ -d "$dir" ]; then
    echo "📦 Auditing $dir..."
    cd "$dir"
    pnpm audit --audit-level=moderate || true
    cd - > /dev/null
  fi
done

# Generate report
echo "📊 Generating audit report..."
pnpm audit --json > audit-report.json || true

# Check for critical vulnerabilities
CRITICAL=$(cat audit-report.json | grep -o '"severity":"critical"' | wc -l || echo "0")
HIGH=$(cat audit-report.json | grep -o '"severity":"high"' | wc -l || echo "0")

echo "===================="
echo "Audit Summary:"
echo "Critical: $CRITICAL"
echo "High: $HIGH"
echo "===================="

if [ "$CRITICAL" -gt "0" ]; then
  echo "❌ CRITICAL vulnerabilities found! Please fix immediately."
  exit 1
elif [ "$HIGH" -gt "0" ]; then
  echo "⚠️  HIGH vulnerabilities found. Please review."
  # Warning only in CI, don't block local development
  if [ "$CI" = "true" ]; then
    exit 1
  else
    echo "   (Run in CI mode with CI=true to fail on HIGH vulnerabilities)"
    exit 0
  fi
else
  echo "✅ No critical or high vulnerabilities found."
  exit 0
fi
