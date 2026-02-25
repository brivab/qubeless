#!/usr/bin/env sh
set -uo pipefail

OUT_DIR=${OUT_DIR:-/out}
WORKSPACE=${WORKSPACE:-/workspace}

mkdir -p "$OUT_DIR"

SEMGREP_JSON="$OUT_DIR/semgrep.json"
REPORT_JSON="$OUT_DIR/report.json"
MEASURES_JSON="$OUT_DIR/measures.json"
RUN_LOG="$OUT_DIR/run.log"
SEMGREP_LOG="$OUT_DIR/semgrep.log"

CONFIG_PATH="$WORKSPACE/.project/config/semgrep.json"
CONFIG_ARG="--config=auto"
CONFIG_USED="auto"

if [ -f "$CONFIG_PATH" ]; then
  CONFIG_ARG="--config=$CONFIG_PATH"
  CONFIG_USED="$CONFIG_PATH"
fi

SEMREG_VERSION=$(semgrep --version 2>/dev/null | head -n 1 | awk '{print $NF}')
if [ -z "$SEMREG_VERSION" ]; then
  SEMREG_VERSION="unknown"
fi

# Ensure git is happy with the workspace ownership (common in containers)
git config --global --add safe.directory "$WORKSPACE" >/dev/null 2>&1 || true

CMD="semgrep scan $CONFIG_ARG --disable-version-check --json --output $SEMGREP_JSON $WORKSPACE"

echo "Command: $CMD" > "$RUN_LOG"
echo "Config used: $CONFIG_USED" >> "$RUN_LOG"
echo "Workspace preview (max 20 files):" >> "$RUN_LOG"
find "$WORKSPACE" -type f | head -n 20 >> "$RUN_LOG" || true

SEMGREP_ENABLE_VERSION_CHECK=0 SEMGREP_DISABLE_VERSION_CHECK=1 $CMD > "$SEMGREP_LOG" 2>&1
semgrep_status=$?

if [ $semgrep_status -ge 2 ]; then
  echo "Semgrep returned error code $semgrep_status" >> "$RUN_LOG"
  echo "---- semgrep output ----" >> "$RUN_LOG"
  cat "$SEMGREP_LOG" >> "$RUN_LOG"
  echo "------------------------" >> "$RUN_LOG"
fi

# Extract rules metadata from the Semgrep JSON output (it already contains rule info)
# We'll process this in Python below

issues_count=$(
  SEMREG_VERSION="$SEMREG_VERSION" \
  SEMGREP_JSON="$SEMGREP_JSON" \
  REPORT_JSON="$REPORT_JSON" \
  MEASURES_JSON="$MEASURES_JSON" \
  WORKSPACE="$WORKSPACE" \
  python3 - <<'PY' 2>>"$RUN_LOG"
import hashlib
import json
import os
import sys

semgrep_json = os.environ.get("SEMGREP_JSON")
report_path = os.environ.get("REPORT_JSON")
measures_path = os.environ.get("MEASURES_JSON")
workspace = os.environ.get("WORKSPACE", "/workspace")
analyzer_version = os.environ.get("SEMREG_VERSION", "unknown")

data = {}
results = []
if semgrep_json and os.path.isfile(semgrep_json):
    try:
        with open(semgrep_json, 'r', encoding='utf-8') as f:
            data = json.load(f)
        results = data.get("results", [])
    except Exception as exc:
        print(f"[parser] failed to parse semgrep JSON: {exc}", file=sys.stderr)
else:
    if semgrep_json:
        print(f"[parser] semgrep JSON not found: {semgrep_json}", file=sys.stderr)

severity_map = {
    "INFO": "INFO",
    "WARNING": "MINOR",
    "LOW": "MINOR",
    "MEDIUM": "MAJOR",
    "MODERATE": "MAJOR",
    "HIGH": "CRITICAL",
    "ERROR": "MAJOR",
    "CRITICAL": "BLOCKER",
}


def map_severity(raw):
    key = str(raw or "").upper()
    return severity_map.get(key, "MINOR")


def normalize_path(path_value: str) -> str:
    path = path_value or ""
    if not path:
        return path
    if workspace and path.startswith(workspace.rstrip("/") + "/"):
        try:
            return os.path.relpath(path, workspace)
        except ValueError:
            return path.lstrip("/")
    return path


def infer_type(extra: dict, severity: str) -> str:
    metadata = extra.get("metadata") or {}
    category = str(metadata.get("category", "")).lower()
    if category == "security":
        return "VULNERABILITY"

    tags = metadata.get("tags") or []
    tags_text = " ".join(tags) if isinstance(tags, list) else str(tags)
    metadata_dump = json.dumps(metadata).lower() if metadata else ""

    if "security" in tags_text.lower() or "owasp" in metadata_dump or "cwe" in metadata_dump:
        return "VULNERABILITY"

    if severity in ("CRITICAL", "BLOCKER", "MAJOR"):
        return "BUG"

    return "CODE_SMELL"


issues = []
for res in results:
    extra = res.get("extra") or {}
    message = (extra.get("message") or "").strip()
    rule_key = res.get("check_id") or extra.get("id") or "UNKNOWN_RULE"
    severity = map_severity(extra.get("severity"))
    path = normalize_path(res.get("path") or extra.get("path") or "")
    start = res.get("start") or {}
    line = start.get("line")
    issue_type = infer_type(extra, severity)

    fingerprint_source = f"{rule_key}|{path}|{line}|{message}"
    fingerprint = hashlib.sha256(fingerprint_source.encode("utf-8")).hexdigest()

    issues.append(
        {
            "ruleKey": rule_key,
            "severity": severity,
            "type": issue_type,
            "filePath": path,
            "line": line,
            "message": message,
            "fingerprint": fingerprint,
        }
    )

# Extract all available rules from the Semgrep output
# Semgrep includes rule metadata in the results, we'll collect unique rules
rules_catalog = []
seen_rule_ids = set()

# First, extract rules from results (issues found)
for res in results:
    extra = res.get("extra") or {}
    rule_id = res.get("check_id") or extra.get("id") or ""

    if not rule_id or rule_id in seen_rule_ids:
        continue

    seen_rule_ids.add(rule_id)

    message = (extra.get("message") or "").strip()
    severity_raw = extra.get("severity", "WARNING")
    severity = map_severity(severity_raw)
    metadata = extra.get("metadata") or {}
    issue_type = infer_type(extra, severity)

    rules_catalog.append({
        "key": rule_id,
        "name": message[:100] if message else rule_id,
        "description": message or "",
        "severity": severity,
        "type": issue_type,
    })

# Also extract from the top-level "rules" field if present (newer Semgrep versions)
all_rules_metadata = data.get("rules", [])
for rule_meta in all_rules_metadata:
    rule_id = rule_meta.get("id") or rule_meta.get("check_id") or ""

    if not rule_id or rule_id in seen_rule_ids:
        continue

    seen_rule_ids.add(rule_id)

    message = rule_meta.get("message", "")
    severity_raw = rule_meta.get("severity", "WARNING")
    severity = map_severity(severity_raw)
    metadata = rule_meta.get("metadata") or {}
    issue_type = infer_type({"metadata": metadata}, severity)

    rules_catalog.append({
        "key": rule_id,
        "name": message[:100] if message else rule_id,
        "description": message or "",
        "severity": severity,
        "type": issue_type,
    })

print(f"[parser] Extracted {len(rules_catalog)} unique rules from Semgrep output", file=sys.stderr)

report_payload = {
    "analyzer": {"name": "semgrep", "version": analyzer_version},
    "issues": issues,
    "rules": rules_catalog,
}

with open(report_path, "w", encoding="utf-8") as f:
    json.dump(report_payload, f, indent=2)

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

print(len(issues))
PY
)

if [ -z "$issues_count" ]; then
  issues_count=0
fi

echo "Issues in report: $issues_count" >> "$RUN_LOG"
echo "Semgrep exit code: $semgrep_status (0=no issues, 1=issues, >=2=error)" >> "$RUN_LOG"

if [ $semgrep_status -ge 2 ]; then
  echo "Analyzer completed with errors; results may be partial." >> "$RUN_LOG"
else
  echo "Analyzer completed successfully." >> "$RUN_LOG"
fi
