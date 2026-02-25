# Security Policy

## Supported Versions

Security fixes are provided for the latest code on `main`.

## Reporting a Vulnerability

Please do not report security issues in public GitHub issues.

Preferred process:

1. Use GitHub private vulnerability reporting (Security Advisory) if enabled.
2. If private reporting is not available, open a minimal issue asking for a private contact channel, without disclosing exploit details.

When reporting, include:

- Affected component and version/commit
- Reproduction steps
- Impact assessment
- Suggested mitigation (if known)

## Operational Security Notes

### Docker Socket Exposure (`/var/run/docker.sock`)

Qubeless worker uses the Docker socket to run analyzer containers. Any container with access to the socket can potentially control the Docker host.

Mitigations:

- Deploy on a dedicated host or VM (recommended)
- Restrict host access and Docker group membership
- Restrict who can exec into worker containers
- Keep worker service internal-only (no published ports)
- Segment network access between components
- Keep host OS and Docker patched

See deployment hardening guidance in:

- `docs/en/deploy.md`
- `docs/fr/deploy.md`
