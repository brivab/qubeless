# LLM Provider, Prompt, and AI Issue Resolution

This guide explains how to:

1. Configure an LLM provider.
2. Configure and activate an LLM prompt template.
3. Resolve an issue with AI from the Qubeless analysis UI.

## Prerequisites

- You are authenticated in Qubeless.
- You have admin access for LLM provider and prompt setup.
- You already have a project and at least one analysis with issues.

## 1) Configure an LLM Provider (Admin)

UI path:

- `Admin -> LLM Providers`
- Route: `/admin/llm-providers`

Create a provider with:

- `name`: display label in Qubeless.
- `providerType`: provider family (example: `openai`).
- `baseUrl`: OpenAI-compatible API endpoint.
- `model`: model ID to call.
- `token`: provider API key.
- `headersJson` (optional): extra HTTP headers as JSON.
- `isDefault` (optional): fallback provider used when a project does not select one.

Then click `Test` on the provider card to validate connectivity.

API endpoints:

- `GET /admin/llm-providers`
- `POST /admin/llm-providers`
- `PUT /admin/llm-providers/:id`
- `DELETE /admin/llm-providers/:id`
- `POST /admin/llm-providers/:id/test`

## 2) Configure an LLM Prompt Template (Admin)

UI path:

- `Admin -> LLM Prompts`
- Route: `/admin/llm-prompts`

Create a prompt template with:

- `name`: template family name.
- `version`: template version (example: `v1`).
- `systemPrompt`: global behavior and constraints.
- `taskPrompt`: task instructions for code fix generation.
- `isActive`: enable this template as active.

Important behavior:

- Qubeless appends structured issue/context input to `taskPrompt`.
- Qubeless enforces a strict JSON output format for file changes.
- Only one prompt is used at runtime: the active one.

API endpoints:

- `GET /admin/llm-prompts`
- `POST /admin/llm-prompts`
- `PUT /admin/llm-prompts/:id`
- `DELETE /admin/llm-prompts/:id`
- `POST /admin/llm-prompts/:id/activate`

## 3) Configure Project LLM Settings

UI path:

- Open your project
- `LLM` tab in project details

You can:

- Select a specific provider for this project, or keep default provider behavior.
- Set optional overrides:
  - `temperature` (0 to 2)
  - `topP` (0 to 1)
  - `maxTokens` (1 to 200000)

API endpoints:

- `GET /projects/:key/llm-settings`
- `PUT /projects/:key/llm-settings`

## 4) Resolve an Issue via AI

UI flow:

1. Open an analysis.
2. Go to `Issues`.
3. On an issue card, click `Resolve via LLM`.
4. Open `LLM runs` to follow execution status and output.

![Resolve issue via AI - UI flow](src/assets/features/auto-fix-light.png)

Run statuses:

- `QUEUED`
- `RUNNING`
- `SUCCESS`
- `FAILED`

On success, Qubeless creates a branch + PR/MR in your VCS and stores:

- run summary,
- generated file changes,
- created PR/MR link.

Issue APIs:

- `POST /issues/:id/resolve` (start LLM run)
- `GET /issues/:id/llm-runs` (list run history)

## Runtime Requirements for AI Resolution

The LLM issue resolution job requires:

- an effective LLM provider (project provider or default provider),
- an active prompt template,
- a `SOURCE_ZIP` artifact for the issue analysis,
- pull request context on the analysis,
- a VCS token (user token, global token, or environment token).

If one of these requirements is missing, the run fails with an explicit error message in `LLM runs`.
