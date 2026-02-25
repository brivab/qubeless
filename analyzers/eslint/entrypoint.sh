#!/usr/bin/env bash
set -euo pipefail

OUT_DIR=${OUT_DIR:-/out}
WORKSPACE=${WORKSPACE:-/workspace}

# Create the output directory if it doesn't exist
mkdir -p "$OUT_DIR"

# Define paths for various log and report files
ESLINT_JSON="$OUT_DIR/eslint.json"
REPORT_JSON="$OUT_DIR/report.json"
MEASURES_JSON="$OUT_DIR/measures.json"
RUN_LOG="$OUT_DIR/run.log"
ESLINT_STDOUT="$OUT_DIR/eslint.log"

# Log the start of the ESLint analysis
echo "Starting ESLint analyzer" > "$RUN_LOG"
echo "Workspace: $WORKSPACE" >> "$RUN_LOG"

# Create a temporary copy of the workspace to avoid modifying the original
WORKDIR_COPY="/tmp/workspace"
rm -rf "$WORKDIR_COPY"
mkdir -p "$WORKDIR_COPY"

# Use rsync if available to exclude node_modules and .git, otherwise use cp
if command -v rsync >/dev/null 2>&1; then
  rsync -a --exclude node_modules --exclude .git "$WORKSPACE"/ "$WORKDIR_COPY"/ >>"$RUN_LOG" 2>&1 || true
else
  cp -R "$WORKSPACE"/. "$WORKDIR_COPY"/ >>"$RUN_LOG" 2>&1 || true
fi

# Check if a package.json exists and determine the dependencies installation command
HAS_PACKAGE_JSON=0
INSTALL_FAILED=0

if [ -f "$WORKDIR_COPY/package.json" ]; then
  HAS_PACKAGE_JSON=1
  if [ -f "$WORKDIR_COPY/package-lock.json" ]; then
    INSTALL_CMD="npm ci --ignore-scripts --no-audit --no-fund"
  else
    INSTALL_CMD="npm install --ignore-scripts --no-audit --no-fund"
  fi
  echo "Running dependencies install: (cd $WORKDIR_COPY && $INSTALL_CMD)" >> "$RUN_LOG"
  if (cd "$WORKDIR_COPY" && $INSTALL_CMD) >>"$RUN_LOG" 2>&1; then
    echo "Dependencies install succeeded." >> "$RUN_LOG"
  else
    echo "Dependencies install failed. Falling back to bundled ESLint." >> "$RUN_LOG"
    INSTALL_FAILED=1
  fi
else
  echo "No package.json found; using bundled ESLint with fallback config." >> "$RUN_LOG"
fi

# Set the path to the locally installed ESLint or the bundled one
LOCAL_ESLINT_BIN="$WORKDIR_COPY/node_modules/.bin/eslint"
ESLINT_BIN="$LOCAL_ESLINT_BIN"
ESLINT_SOURCE="workspace"

if [ ! -x "$ESLINT_BIN" ] || [ $INSTALL_FAILED -eq 1 ]; then
  ESLINT_BIN="/opt/eslint/node_modules/.bin/eslint"
  ESLINT_SOURCE="bundled"
fi

# Determine the version of ESLint being used
ESLINT_VERSION=$("$ESLINT_BIN" -v 2>/dev/null | head -n 1 | tr -d 'v')
[ -z "$ESLINT_VERSION" ] && ESLINT_VERSION="unknown"

# Ensure that bundled parser/plugins are resolvable when using the built-in ESLint/fallback config
export NODE_PATH="/opt/eslint/node_modules:${NODE_PATH:-}"

# Create a fallback ESLint configuration if none is found in the workspace
FALLBACK_CONFIG="/tmp/eslint-fallback.json"
cat > "$FALLBACK_CONFIG" <<'EOF'
{
  "env": { "es2021": true, "node": true, "browser": true },
  "parserOptions": { "ecmaVersion": "latest", "sourceType": "module" },
  "overrides": [
    {
      "files": ["*.ts", "*.tsx"],
      "parser": "@typescript-eslint/parser",
      "plugins": ["@typescript-eslint"],
      "parserOptions": { "ecmaVersion": "latest", "sourceType": "module" }
    }
  ],
  "ignorePatterns": ["node_modules", "dist", "build", "coverage"],
  "extends": ["eslint:recommended"],
  "rules": {}
}
EOF

# Determine the ESLint configuration file to use
CONFIG_FILE=""
for candidate in \
  "eslint.config.js" "eslint.config.cjs" "eslint.config.mjs" \
  ".eslintrc" ".eslintrc.js" ".eslintrc.cjs" ".eslintrc.json" ".eslintrc.yml" ".eslintrc.yaml"
do
  if [ -f "$WORKDIR_COPY/$candidate" ]; then
    CONFIG_FILE="$WORKDIR_COPY/$candidate"
    break
  fi
done

CONFIG_ARG=""
if [ -z "$CONFIG_FILE" ]; then
  CONFIG_FILE="$FALLBACK_CONFIG"
  CONFIG_ARG="--config $FALLBACK_CONFIG"
fi

# Define base arguments for the ESLint command
BASE_ARGS="--ext .js,.jsx,.ts,.tsx --format json --output-file $ESLINT_JSON --no-error-on-unmatched-pattern"
CMD="$ESLINT_BIN $BASE_ARGS $CONFIG_ARG ."
FALLBACK_CMD="$ESLINT_BIN $BASE_ARGS --config $FALLBACK_CONFIG --no-eslintrc ."

# Log the ESLint source, configuration file, and command being run
echo "ESLint source: $ESLINT_SOURCE ($ESLINT_BIN)" >> "$RUN_LOG"
echo "Config: ${CONFIG_FILE:-auto}" >> "$RUN_LOG"
echo "Command: (cd $WORKDIR_COPY && $CMD)" >> "$RUN_LOG"

# Run the ESLint command and capture the output and status
set +e
(cd "$WORKDIR_COPY" && $CMD) > "$ESLINT_STDOUT" 2>&1
ESLINT_STATUS=$?
set -e

# If ESLint fails with a non-zero exit code, retry with the fallback configuration
if [ $ESLINT_STATUS -ge 2 ] && [ -n "$CONFIG_FILE" ] && [ "$CONFIG_FILE" != "$FALLBACK_CONFIG" ]; then
  echo "ESLint failed with status $ESLINT_STATUS; retrying with fallback config." >> "$RUN_LOG"
  echo "Fallback command: (cd $WORKDIR_COPY && $FALLBACK_CMD)" >> "$RUN_LOG"
  set +e
  (cd "$WORKDIR_COPY" && $FALLBACK_CMD) > "$ESLINT_STDOUT" 2>&1
  ESLINT_STATUS=$?
  set -e
fi

# Log the ESLint exit code and issues count
if [ $ESLINT_STATUS -ge 2 ]; then
  echo "ESLint returned error code $ESLINT_STATUS" >> "$RUN_LOG"
  echo "---- ESLint output ----" >> "$RUN_LOG"
  cat "$ESLINT_STDOUT" >> "$RUN_LOG"
  echo "-----------------------" >> "$RUN_LOG"
fi

# Parse the ESLint JSON output and generate a report
ISSUES_COUNT=$(
  ESLINT_JSON="$ESLINT_JSON" \
  REPORT_JSON="$REPORT_JSON" \
  MEASURES_JSON="$MEASURES_JSON" \
  ESLINT_VERSION="$ESLINT_VERSION" \
  ESLINT_WORKDIR="$WORKDIR_COPY" \
  WORKSPACE_ORIGINAL="$WORKSPACE" \
  ESLINT_BIN="$ESLINT_BIN" \
  node - <<'NODE' 2>>"$RUN_LOG"
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const eslintPath = process.env.ESLINT_JSON;
const reportPath = process.env.REPORT_JSON;
const measuresPath = process.env.MEASURES_JSON;
const workdir = process.env.ESLINT_WORKDIR || '/workspace';
const workspaceOriginal = process.env.WORKSPACE_ORIGINAL || '/workspace';
const analyzerVersion = process.env.ESLINT_VERSION || 'unknown';

let raw = [];
try {
  const content = fs.readFileSync(eslintPath, 'utf8');
  raw = JSON.parse(content);
} catch (err) {
  console.error(`[parser] failed to read ESLint JSON: ${err.message}`);
  raw = [];
}

const severityMap = {
  2: 'MAJOR',
  1: 'MINOR',
};

const issues = [];
let errorCount = 0;
let warningCount = 0;

function normalizePath(filePath) {
  if (!filePath) return filePath;
  let rel = path.relative(workdir, filePath);
  if (rel.startsWith('..')) {
    const relFromOriginal = path.relative(workspaceOriginal, filePath);
    rel = relFromOriginal.startsWith('..') ? filePath : relFromOriginal;
  }
  return rel.replace(/^[.][/\\]/, '');
}

function inferType(ruleId, message, mappedSeverity) {
  const text = `${ruleId || ''} ${message || ''}`.toLowerCase();
  if (text.includes('security')) return 'VULNERABILITY';
  if (/no-?eval|no-implied-eval|no-new-func|detect|unsafe/.test(text)) return 'VULNERABILITY';
  if (mappedSeverity === 'MAJOR') return 'BUG';
  return 'CODE_SMELL';
}

for (const result of raw) {
  const file = normalizePath(result.filePath || '');
  const messages = result.messages || [];
  for (const msg of messages) {
    const mappedSeverity = severityMap[msg.severity] || 'MINOR';
    if (msg.severity === 2) errorCount += 1;
    else warningCount += 1;

    const ruleId = msg.ruleId || 'unknown';
    const ruleKey = `eslint:${ruleId}`;
    const issueType = inferType(ruleId, msg.message, mappedSeverity);
    const line = msg.line || null;
    const message = (msg.message || '').trim();

    const fingerprintSource = `${ruleKey}|${file}|${line}|${message}`;
    const fingerprint = crypto.createHash('sha256').update(fingerprintSource).digest('hex');

    issues.push({
      ruleKey,
      severity: mappedSeverity,
      type: issueType,
      filePath: file,
      line,
      message,
      fingerprint,
    });
  }
}

// Extract all available rules from ESLint
const rules = [];
try {
  const { ESLint } = require('eslint');
  const eslint = new ESLint();

  // Get core rules
  const { builtinRules } = require('eslint/use-at-your-own-risk');
  for (const [ruleId, ruleDef] of builtinRules.entries()) {
    const meta = ruleDef.meta || {};
    const docs = meta.docs || {};

    rules.push({
      key: `eslint:${ruleId}`,
      name: docs.description || ruleId,
      description: docs.description || '',
      severity: meta.type === 'problem' ? 'MAJOR' : 'MINOR',
      type: inferType(ruleId, docs.description || '', meta.type === 'problem' ? 'MAJOR' : 'MINOR'),
    });
  }
} catch (err) {
  console.error(`[parser] failed to extract ESLint rules: ${err.message}`);
}

const report = {
  analyzer: { name: 'eslint', version: analyzerVersion },
  issues,
  rules,
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

const severityKeys = ['BLOCKER', 'CRITICAL', 'MAJOR', 'MINOR', 'INFO'];
const typeKeys = ['BUG', 'CODE_SMELL', 'VULNERABILITY'];
const severityCounts = Object.fromEntries(severityKeys.map((k) => [k, 0]));
const typeCounts = Object.fromEntries(typeKeys.map((k) => [k, 0]));

for (const issue of issues) {
  severityCounts[issue.severity] = (severityCounts[issue.severity] || 0) + 1;
  typeCounts[issue.type] = (typeCounts[issue.type] || 0) + 1;
}

const metrics = {
  issues_total: issues.length,
  issues_error_count: errorCount,
  issues_warning_count: warningCount,
};
for (const key of severityKeys) {
  metrics[`issues_by_severity.${key.toLowerCase()}`] = severityCounts[key] || 0;
}
for (const key of typeKeys) {
  metrics[`issues_by_type.${key.toLowerCase()}`] = typeCounts[key] || 0;
}

fs.writeFileSync(measuresPath, JSON.stringify({ metrics }, null, 2), 'utf8');
console.log(issues.length);
NODE
)

[ -z "$ISSUES_COUNT" ] && ISSUES_COUNT=0

echo "Issues in report: $ISSUES_COUNT" >> "$RUN_LOG"
echo "ESLint exit code: $ESLINT_STATUS (0=clean, 1=lint errors, >=2=runtime error)" >> "$RUN_LOG"

if [ $ESLINT_STATUS -ge 2 ]; then
  echo "Analyzer completed with errors; results may be partial." >> "$RUN_LOG"
else
  echo "Analyzer completed." >> "$RUN_LOG"
fi
