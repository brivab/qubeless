#!/usr/bin/env bash
set -euo pipefail

OUT_DIR=${OUT_DIR:-/out}
WORKSPACE=${WORKSPACE:-/workspace}

mkdir -p "$OUT_DIR"

TRIVY_JSON="$OUT_DIR/trivy.json"
REPORT_JSON="$OUT_DIR/report.json"
MEASURES_JSON="$OUT_DIR/measures.json"
RUN_LOG="$OUT_DIR/run.log"
TRIVY_STDOUT="$OUT_DIR/trivy.log"

echo "Starting Trivy analyzer" > "$RUN_LOG"
echo "Workspace: $WORKSPACE" >> "$RUN_LOG"

# Get Trivy version (compatible with BusyBox grep)
TRIVY_VERSION=$(trivy --version 2>/dev/null | grep -o 'Version: [^ ]*' | cut -d' ' -f2 || echo "unknown")
if [ -z "$TRIVY_VERSION" ]; then
  TRIVY_VERSION="unknown"
fi

echo "Trivy version: $TRIVY_VERSION" >> "$RUN_LOG"

# Determine scanners to use
TRIVY_SCANNERS=${TRIVY_SCANNERS:-"vuln,misconfig"}
echo "Scanners: $TRIVY_SCANNERS" >> "$RUN_LOG"

# Exclusions for common directories
EXCLUSIONS=(
  ".git"
  "node_modules"
  "dist"
  "build"
  ".venv"
  "venv"
  "target"
  "__pycache__"
  ".eggs"
  ".tox"
  "site-packages"
)

# Build skipDirs argument
SKIP_DIRS=""
for dir in "${EXCLUSIONS[@]}"; do
  SKIP_DIRS="$SKIP_DIRS --skip-dirs $dir"
done

echo "Running Trivy filesystem scan..." >> "$RUN_LOG"

# Build the command
CMD="trivy fs $SKIP_DIRS --format json --scanners $TRIVY_SCANNERS --output $TRIVY_JSON"

# Add timeout if configured
TRIVY_TIMEOUT=${TRIVY_TIMEOUT:-10m}
CMD="$CMD --timeout $TRIVY_TIMEOUT"

# Offline scan if configured
if [ "$TRIVY_OFFLINE_SCAN" = "true" ]; then
  CMD="$CMD --offline-scan"
  echo "Offline scan enabled" >> "$RUN_LOG"
fi

# Add workspace path
CMD="$CMD $WORKSPACE"

echo "Command: $CMD" >> "$RUN_LOG"

# Run Trivy
set +e
eval "$CMD" > "$TRIVY_STDOUT" 2>&1
TRIVY_STATUS=$?
set -e

echo "Trivy exit code: $TRIVY_STATUS" >> "$RUN_LOG"

if [ $TRIVY_STATUS -ne 0 ]; then
  echo "Trivy encountered errors" >> "$RUN_LOG"
  echo "---- Trivy stderr ----" >> "$RUN_LOG"
  cat "$TRIVY_STDOUT" >> "$RUN_LOG" || true
  echo "----------------------" >> "$RUN_LOG"
fi

# Check if JSON output exists
if [ ! -f "$TRIVY_JSON" ]; then
  echo "Trivy JSON output not found, creating empty result" >> "$RUN_LOG"
  echo '{"Results": []}' > "$TRIVY_JSON"
fi

# Parse Trivy JSON and convert to standard format
ISSUES_COUNT=$(
  TRIVY_JSON="$TRIVY_JSON" \
  REPORT_JSON="$REPORT_JSON" \
  MEASURES_JSON="$MEASURES_JSON" \
  WORKSPACE="$WORKSPACE" \
  TRIVY_VERSION="$TRIVY_VERSION" \
  python3 - <<'PYTHON' 2>>"$RUN_LOG"
import hashlib
import json
import os
import sys

trivy_json_path = os.environ.get("TRIVY_JSON")
report_path = os.environ.get("REPORT_JSON")
measures_path = os.environ.get("MEASURES_JSON")
workspace = os.environ.get("WORKSPACE", "/workspace")
analyzer_version = os.environ.get("TRIVY_VERSION", "unknown")

# Read Trivy JSON output
data = {}
results = []
if trivy_json_path and os.path.isfile(trivy_json_path):
    try:
        with open(trivy_json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        results = data.get("Results", [])
    except Exception as exc:
        print(f"[parser] failed to parse Trivy JSON: {exc}", file=sys.stderr)
        results = []
else:
    print(f"[parser] Trivy JSON not found: {trivy_json_path}", file=sys.stderr)

# Severity mapping
severity_map = {
    "CRITICAL": "BLOCKER",
    "HIGH": "CRITICAL",
    "MEDIUM": "MAJOR",
    "LOW": "MINOR",
    "UNKNOWN": "INFO",
}

def map_severity(trivy_severity: str) -> str:
    """Map Trivy severity to standard severity"""
    key = str(trivy_severity or "").upper()
    return severity_map.get(key, "MINOR")

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

def infer_type(vuln_type: str, severity: str) -> str:
    """Infer issue type based on Trivy result type"""
    vuln_type_lower = str(vuln_type or "").lower()

    # Security vulnerabilities
    if vuln_type_lower in ("vulnerability", "vuln"):
        return "VULNERABILITY"

    # Misconfigurations
    if vuln_type_lower in ("misconfig", "misconfiguration"):
        if severity in ("BLOCKER", "CRITICAL"):
            return "VULNERABILITY"
        return "CODE_SMELL"

    # Secrets
    if vuln_type_lower in ("secret", "secrets"):
        return "VULNERABILITY"

    # Default to vulnerability for high severity, code smell otherwise
    if severity in ("BLOCKER", "CRITICAL"):
        return "VULNERABILITY"

    return "CODE_SMELL"

# Process issues
issues = []
rules_catalog = {}

for result in results:
    target = result.get("Target", "")
    result_type = result.get("Type", "")
    result_class = result.get("Class", "")

    # Process vulnerabilities
    vulnerabilities = result.get("Vulnerabilities") or []
    for vuln in vulnerabilities:
        vuln_id = vuln.get("VulnerabilityID") or "UNKNOWN"
        title = vuln.get("Title") or vuln_id
        description = vuln.get("Description") or title
        pkg_name = vuln.get("PkgName") or ""
        installed_version = vuln.get("InstalledVersion") or ""
        fixed_version = vuln.get("FixedVersion") or ""

        severity = map_severity(vuln.get("Severity"))
        issue_type = infer_type("vulnerability", severity)

        # Build message
        message = f"{title}"
        if pkg_name:
            message = f"{pkg_name}: {message}"
        if installed_version:
            message += f" (installed: {installed_version}"
            if fixed_version:
                message += f", fixed in: {fixed_version}"
            message += ")"

        rule_id = f"trivy:{vuln_id}"
        file_path = normalize_path(target)

        # Create fingerprint
        fingerprint_source = f"{rule_id}|{file_path}|{pkg_name}|{installed_version}"
        fingerprint = hashlib.sha256(fingerprint_source.encode("utf-8")).hexdigest()

        issues.append({
            "ruleKey": rule_id,
            "severity": severity,
            "type": issue_type,
            "filePath": file_path,
            "line": 1,
            "column": 0,
            "endLine": 1,
            "endColumn": 0,
            "message": message,
            "fingerprint": fingerprint,
        })

        # Add to rules catalog
        if rule_id not in rules_catalog:
            rules_catalog[rule_id] = {
                "key": rule_id,
                "name": title,
                "description": description[:200] if description else title,
                "severity": severity,
                "type": issue_type,
            }

    # Process misconfigurations
    misconfigurations = result.get("Misconfigurations") or []
    for misconfig in misconfigurations:
        misconfig_id = misconfig.get("ID") or "UNKNOWN"
        title = misconfig.get("Title") or misconfig_id
        description = misconfig.get("Description") or title
        message_text = misconfig.get("Message") or description

        severity = map_severity(misconfig.get("Severity"))
        issue_type = infer_type("misconfig", severity)

        rule_id = f"trivy:{misconfig_id}"
        file_path = normalize_path(target)

        # Get line number from CauseMetadata if available
        line = 1
        cause_metadata = misconfig.get("CauseMetadata") or {}
        if "StartLine" in cause_metadata:
            line = cause_metadata.get("StartLine", 1)

        # Create fingerprint
        fingerprint_source = f"{rule_id}|{file_path}|{line}|{title}"
        fingerprint = hashlib.sha256(fingerprint_source.encode("utf-8")).hexdigest()

        issues.append({
            "ruleKey": rule_id,
            "severity": severity,
            "type": issue_type,
            "filePath": file_path,
            "line": line,
            "column": 0,
            "endLine": line,
            "endColumn": 0,
            "message": message_text,
            "fingerprint": fingerprint,
        })

        # Add to rules catalog
        if rule_id not in rules_catalog:
            rules_catalog[rule_id] = {
                "key": rule_id,
                "name": title,
                "description": description[:200] if description else title,
                "severity": severity,
                "type": issue_type,
            }

    # Process secrets (if enabled)
    secrets = result.get("Secrets") or []
    for secret in secrets:
        rule_id_raw = secret.get("RuleID") or "SECRET"
        title = secret.get("Title") or rule_id_raw
        match_text = secret.get("Match") or ""

        severity = map_severity(secret.get("Severity", "CRITICAL"))
        issue_type = "VULNERABILITY"

        rule_id = f"trivy:{rule_id_raw}"
        file_path = normalize_path(target)

        # Get line number
        line = secret.get("StartLine", 1)

        # Sanitize message - DO NOT include the actual secret
        message = f"Potential secret detected: {title}"

        # Create fingerprint (without the match to avoid exposing secrets)
        fingerprint_source = f"{rule_id}|{file_path}|{line}|{title}"
        fingerprint = hashlib.sha256(fingerprint_source.encode("utf-8")).hexdigest()

        issues.append({
            "ruleKey": rule_id,
            "severity": severity,
            "type": issue_type,
            "filePath": file_path,
            "line": line,
            "column": 0,
            "endLine": line,
            "endColumn": 0,
            "message": message,
            "fingerprint": fingerprint,
        })

        # Add to rules catalog
        if rule_id not in rules_catalog:
            rules_catalog[rule_id] = {
                "key": rule_id,
                "name": title,
                "description": f"Secret scanning rule: {title}",
                "severity": severity,
                "type": issue_type,
            }

print(f"[parser] Processed {len(issues)} issues from Trivy", file=sys.stderr)
print(f"[parser] Extracted {len(rules_catalog)} unique rules", file=sys.stderr)

# Build report
report_payload = {
    "analyzer": {"name": "trivy", "version": analyzer_version},
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

if [ $TRIVY_STATUS -ne 0 ]; then
  echo "Analyzer completed with errors; results may be partial." >> "$RUN_LOG"
else
  echo "Analyzer completed successfully." >> "$RUN_LOG"
fi
