# Submit Codebase Locally / CI

## Command

```
pnpm submit --server http://localhost:3001 --project <PROJECT_KEY> [options]
```

(If you prefer, `pnpm submit -- --server ...` is still supported.)

## Main Options

- `--server`: Server URL (e.g., `http://localhost:3001`)
- `--project`: Target projectKey
- `--branch` / `--sha`: Overrides if `git` is unavailable or if the repo is not initialized
- `--exclude <pattern...>`: Additional glob patterns to exclude from zip
- `--verbose`: Detailed traces (git, patterns, zip destination)
- `--wait`: Waits for analysis completion on server side
- `--poll-interval <ms>`: Polling interval (ms, default 2000)
- `--timeout <ms>`: Global wait timeout (ms, default 600000)
- `--fail-on-analysis-failed` (default: true): exit 1 if analysis status is `FAILED`
- `--no-gate`: Skips quality gate request (useful if unavailable)
- `--branch-name` / `--branchName`: Alias for `--branch`

## How It Works

- Retrieves the branch (`git rev-parse --abbrev-ref HEAD`) and commit (`git rev-parse HEAD`).
  - If git is missing or the folder is not a repo, pass `--branch` and `--sha`.
- Creates a zip of the repo root (in a temporary folder, e.g., `/tmp/qubeless-submit`).
  - Default exclusions: `.git/`, `node_modules/`, `dist/`, `build/`, `.turbo/`, `.nx/`, `.cache/`, `.DS_Store`, `tmp/`, `temp/`, `.tmp/`.
  - The zip is streamed and displays its size in output.
- Sends a `multipart/form-data` to `POST /projects/:projectKey/analyses` with `branchName`, `commitSha` and `sourceZip`.
- Displays the `analysisId`, `status` (if present) and optionally a URL if provided by the API.
- API tokens are supported via `--token` or `SCANNER_TOKEN` (Bearer).
- If `--wait` is passed:
  - Polls `GET /analyses/:id` until `SUCCESS` or `FAILED` (2s default, 10 min timeout).
  - On success, calls `GET /analyses/:id/quality-gate-status` (unless `--no-gate`).
  - Displays final state and quality gate result (PASS/FAIL).

## Troubleshooting

- **Git unavailable / no repo**: Provide `--branch` and `--sha`.
- **API error**: Check `--server` URL, that the project exists and that infrastructure (`docker-compose -f docker-compose.dev.yml`) is running.
- **Zip too large**: Add targeted exclusions via `--exclude` or clean local artifacts.
- **Unwanted files**: Check exclusion patterns (`--verbose` shows the complete list used).
- **Timeout / polling**: Increase `--timeout` or `--poll-interval`.
- **Quality gate unavailable**: Use `--no-gate` to ignore gate retrieval.

## Exit Codes

- `0`: `SUCCESS` analysis and `PASS` quality gate
- `2`: `SUCCESS` analysis but `FAIL` quality gate
- `1`: Network/server error, timeout, or `FAILED` analysis (unless `--fail-on-analysis-failed=false`)
- `130`: User interruption (Ctrl+C)

## "Local CI" Example

```bash
#!/usr/bin/env bash
set -euo pipefail

SERVER="http://localhost:3001"
PROJECT="myproj"

pnpm submit --server "$SERVER" --project "$PROJECT" --wait --verbose
STATUS=$?

if [ "$STATUS" -eq 2 ]; then
  echo "Quality gate failed"; exit 2
fi

exit "$STATUS"
```

## Scanner (PR/CI Mode)

A more complete CLI is available via `pnpm scanner run`, notably for:

- auto-creating the project and quality gate if absent,
- using API tokens,
- following analysis + retrieving quality gate,
- reading `.gitignore` and automatically excluding standard directories,
- supporting PRs via `--branch` or git detection.

Example:

```bash
pnpm scanner run \
  --server http://localhost:3001/api \
  --project my-project \
  --wait \
  --verbose
```

See `packages/scanner/.codequalityrc.json` for default configuration.
