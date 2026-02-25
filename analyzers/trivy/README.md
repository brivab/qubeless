# Trivy Analyzer

Static analysis container for scanning vulnerabilities and misconfigurations using [Trivy](https://trivy.dev/).

## Features

- **Vulnerability Scanning (SCA)**: Detects known vulnerabilities in dependencies via lockfiles and manifests
- **IaC Misconfiguration Detection**: Scans Terraform, Kubernetes YAML, Dockerfile, Helm charts, and more
- **Secret Scanning** (optional): Detects hardcoded secrets (disabled by default)
- **Multi-language support**: Works with any language/ecosystem Trivy supports
- **Offline-capable**: Can run in offline mode with pre-downloaded databases

## Supported Targets

### Vulnerability Scanning
- Package managers: npm, yarn, pnpm, pip, poetry, maven, gradle, go.mod, etc.
- Lockfiles: package-lock.json, yarn.lock, Pipfile.lock, Gemfile.lock, etc.

### IaC Misconfiguration
- Terraform (.tf files)
- Kubernetes manifests (.yaml, .yml)
- Dockerfiles
- Helm charts
- CloudFormation templates
- Azure ARM templates
- And more...

## Usage

### Build the Image

```bash
./scripts/build-analyzer.sh trivy
```

### Run the Analyzer

```bash
docker run --rm \
  -v /path/to/project:/workspace:ro \
  -v /tmp/output:/out \
  qubeless/analyzer-trivy:latest
```

### Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKSPACE` | `/workspace` | Source code mount point |
| `OUT_DIR` | `/out` | Output directory |
| `TRIVY_SCANNERS` | `vuln,misconfig` | Comma-separated list of scanners (vuln, misconfig, secret) |
| `TRIVY_TIMEOUT` | `10m` | Scan timeout |
| `TRIVY_OFFLINE_SCAN` | `false` | Enable offline scanning (requires DB cache) |
| `TRIVY_CACHE_DIR` | `/tmp/trivy` | Trivy cache directory |

### Enable Secret Scanning

```bash
docker run --rm \
  -e TRIVY_SCANNERS=vuln,misconfig,secret \
  -v /path/to/project:/workspace:ro \
  -v /tmp/output:/out \
  qubeless/analyzer-trivy:latest
```

### Offline Mode

For air-gapped environments, pre-download the Trivy database and mount it:

```bash
# Download DB
trivy image --download-db-only

# Run with offline mode
docker run --rm \
  -e TRIVY_OFFLINE_SCAN=true \
  -v ~/.cache/trivy:/tmp/trivy:ro \
  -v /path/to/project:/workspace:ro \
  -v /tmp/output:/out \
  qubeless/analyzer-trivy:latest
```

## Output Files

### report.json

Standard Qubeless report format containing issues and rules:

```json
{
  "analyzer": {
    "name": "trivy",
    "version": "0.58.1"
  },
  "issues": [
    {
      "ruleKey": "trivy:CVE-2024-1234",
      "severity": "CRITICAL",
      "type": "VULNERABILITY",
      "filePath": "package-lock.json",
      "line": 1,
      "column": 0,
      "endLine": 1,
      "endColumn": 0,
      "message": "lodash: Prototype pollution vulnerability (installed: 4.17.15, fixed in: 4.17.21)",
      "fingerprint": "abc123..."
    },
    {
      "ruleKey": "trivy:DS002",
      "severity": "MAJOR",
      "type": "CODE_SMELL",
      "filePath": "Dockerfile",
      "line": 5,
      "column": 0,
      "endLine": 5,
      "endColumn": 0,
      "message": "Dockerfile should specify a non-root USER",
      "fingerprint": "def456..."
    }
  ],
  "rules": [...]
}
```

### measures.json

Aggregated metrics:

```json
{
  "metrics": {
    "issues_total": 15,
    "issues_by_severity.blocker": 2,
    "issues_by_severity.critical": 3,
    "issues_by_severity.major": 5,
    "issues_by_severity.minor": 5,
    "issues_by_severity.info": 0,
    "issues_by_type.bug": 0,
    "issues_by_type.code_smell": 7,
    "issues_by_type.vulnerability": 8
  }
}
```

### run.log

Execution logs for debugging:

```
Starting Trivy analyzer
Workspace: /workspace
Trivy version: 0.58.1
Scanners: vuln,misconfig
Running Trivy filesystem scan...
Command: trivy fs --skip-dirs .git --skip-dirs node_modules ...
Trivy exit code: 0
Issues in report: 15
Analyzer completed successfully.
```

## Severity Mapping

| Trivy Severity | Qubeless Severity |
|----------------|-------------------|
| CRITICAL | BLOCKER |
| HIGH | CRITICAL |
| MEDIUM | MAJOR |
| LOW | MINOR |
| UNKNOWN | INFO |

## Issue Types

- **VULNERABILITY**: Security vulnerabilities, secrets, critical IaC misconfigurations
- **CODE_SMELL**: IaC misconfigurations (non-critical)
- **BUG**: Not currently used by Trivy analyzer

## Excluded Directories

The following directories are automatically excluded from scanning:

- `.git`
- `node_modules`
- `dist`
- `build`
- `.venv`, `venv`
- `target`
- `__pycache__`
- `.eggs`, `.tox`
- `site-packages`

## Testing

Run the smoke test:

```bash
cd analyzers/trivy
./test.sh
```

This will:
1. Build the Docker image
2. Run it against the demo project in `examples/trivy-demo`
3. Validate the output files
4. Display sample findings

## Examples

See `examples/trivy-demo/` for a sample project containing:
- Vulnerable dependencies (package.json with outdated packages)
- IaC misconfigurations (insecure Dockerfile, Kubernetes manifests)

## Limitations

- First run requires internet connection to download vulnerability database (unless using offline mode)
- Large monorepos may take longer to scan
- Secret scanning has a higher false-positive rate; review results carefully

## Resources

- [Trivy Documentation](https://aquasecurity.github.io/trivy/)
- [Supported Vulnerability Databases](https://aquasecurity.github.io/trivy/latest/docs/scanner/vulnerability/)
- [IaC Scanning Guide](https://aquasecurity.github.io/trivy/latest/docs/scanner/misconfiguration/)

## Security Notes

- **Secrets are never exposed**: The analyzer sanitizes secret matches and does not include them in messages or logs
- **Fingerprints are stable**: Issues use deterministic fingerprinting for tracking across scans
- **Read-only workspace**: The analyzer only reads from `/workspace`, never writes to it
