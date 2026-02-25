# Qubeless: PR Integration (GitHub & GitLab)

This document describes the end-to-end flow for analyzing a Pull Request / Merge Request with Qubeless, publishing a status check and automatic comment.

## Prerequisites
- **Qubeless API** deployed with up-to-date migrations (PR + webhooks support).
- **Worker** started with network access to GitHub/GitLab APIs to publish statuses/comments.
- Secrets:
  - `GITHUB_WEBHOOK_SECRET` (GitHub) / `GITLAB_WEBHOOK_SECRET` (GitLab) to validate webhooks.
  - `GITHUB_TOKEN` (or `GITHUB_STATUS_TOKEN`) and/or `GITLAB_TOKEN` (or `GITLAB_STATUS_TOKEN`) with write permissions for PR/MR statuses/comments.
  - `WEB_APP_URL` pointing to the UI (used for status/comment links).

## API Webhooks
- Endpoints:
  - `POST /api/webhooks/github`
  - `POST /api/webhooks/gitlab`
- Signature verification:
  - GitHub: `X-Hub-Signature-256` header (secret `GITHUB_WEBHOOK_SECRET`).
  - GitLab: `X-Gitlab-Token` header (secret `GITLAB_WEBHOOK_SECRET`).
- Supported events:
  - GitHub: `pull_request` actions `opened`, `synchronize`, `reopened`.
  - GitLab: MR actions `open`, `update`, `reopen`.
- Extracted data:
  - `repo` (full name), `prNumber`/`iid`, `sourceBranch`, `targetBranch`, `commitSha`.
- Effect:
  - Create/update PullRequest entity (auto-creates project if absent, key = repo full name).
  - Trigger an analysis associated with the PR.

## Worker Pipeline (PR)
- At analysis start: publish a `Code Quality` status check in `pending` state.
- At completion:
  - Quality Gate PASS → `success` status
  - Quality Gate FAIL → `failure` status
  - Technical failure → `failure` status
- Automatic comment (creates or updates a single comment per analysis):
  - Content: Quality Gate status (PASS/FAIL), number of *new issues*, breakdown by severity, link to analysis page.
  - Internal marker `<!-- qubeless-analysis:<analysisId> -->` to update the comment on re-run.

## GitHub Configuration
1. Create a webhook secret (`GITHUB_WEBHOOK_SECRET`).
2. On GitHub repo: Settings → Webhooks → add:
   - Payload URL: `https://<host>/api/webhooks/github`
   - Content type: `application/json`
   - Secret: `GITHUB_WEBHOOK_SECRET`
   - Events: *Let me select* → `Pull requests`
3. Set `GITHUB_TOKEN` (PAT or GitHub App) with `repo:status` / `public_repo` scope as needed.

## GitLab Configuration
1. Create a webhook secret (`GITLAB_WEBHOOK_SECRET`).
2. On GitLab project: Settings → Webhooks:
   - URL: `https://<host>/api/webhooks/gitlab`
   - Secret Token: `GITLAB_WEBHOOK_SECRET`
   - Events: Merge request events.
3. Set `GITLAB_TOKEN` with "api" rights or sufficient permissions to comment and publish statuses.

## Key Environment Variables
- API:
  - `GITHUB_WEBHOOK_SECRET`, `GITLAB_WEBHOOK_SECRET`
- Worker:
  - `GITHUB_TOKEN` / `GITHUB_STATUS_TOKEN`
  - `GITLAB_TOKEN` / `GITLAB_STATUS_TOKEN`
  - `WEB_APP_URL` (e.g., `http://localhost:5173`)

## Summary Flow
1. GitHub/GitLab sends PR/MR webhook.
2. Qubeless API validates signature, creates/updates PullRequest and triggers analysis.
3. Worker:
   - publishes `pending` on PR,
   - executes analyzers,
   - evaluates Quality Gate,
   - publishes `success`/`failure` + summary comment.
4. UI displays PR analysis with issues, Quality Gate and link in comment/status.
