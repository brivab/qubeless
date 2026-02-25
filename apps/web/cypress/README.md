# Cypress E2E for `apps/web`

## Scope

The suite covers feature-oriented flows mapped from `apps/site`:

1. Self-hosting entrypoint (quickstart)
2. Modular analyzers
3. Custom analyzer setup
4. Scan to PR/MR prerequisites
5. Metrics and portfolio monitoring
6. LLM integration
7. Automated issue resolution (UI flow)
8. Quality gates

## Prerequisites

1. API reachable (default `http://localhost:3001/api`)
2. Web app running (default `http://localhost:5173`)
3. Admin credentials available

Default credentials used by tests:

- `admin@example.com`
- `admin123`

## Commands

From `apps/web`:

```bash
pnpm cypress:open
pnpm cypress:run
pnpm cypress:demo
```

`pnpm cypress:demo` runs dedicated demo specs (`cypress/e2e/demo/*.demo.cy.ts`) with `--headless --no-runner-ui` and records one clip per feature with slower pacing and on-screen captions.
This mode records only the app viewport (1920x1080), without Cypress runner UI or browser chrome frame.
Each demo spec also captures curated FHD screenshots using `cy.captureDemoScreen(...)`.

Current demo clips:

- `01-auth-and-navigation.demo.cy.ts`
- `02-analyzers.demo.cy.ts`
- `03-quality-gates.demo.cy.ts`
- `04-metrics-and-portfolio.demo.cy.ts`
- `05-quickstart-and-vcs.demo.cy.ts`
- `06-llm-and-autofix.demo.cy.ts`

## Environment variables

- `CYPRESS_BASE_URL` (default: `http://localhost:5173`)
- `CYPRESS_API_URL` (default: `http://localhost:3001/api`)
- `CYPRESS_ADMIN_EMAIL` (default: `admin@example.com`)
- `CYPRESS_ADMIN_PASSWORD` (default: `admin123`)

## Output artifacts

- Videos: `apps/web/cypress/videos`
- Screenshots: `apps/web/cypress/screenshots`

Demo screenshots are stored under `apps/web/cypress/screenshots/demo/`.

If video capture is not usable in the target environment, use the fallback storyboard:

- `apps/web/docs/E2E_FEATURES_STORYBOARD.md`
