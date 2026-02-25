# Testing Guide

Only commands to run existing test suites in this repository.

## From Monorepo Root

```bash
pnpm test
pnpm test:unit
pnpm test:e2e
pnpm test:e2e:quick
pnpm test:e2e:auth
pnpm test:e2e:projects
pnpm test:e2e:analyses
pnpm test:api:auth
pnpm test:api:sso
pnpm test:api:all
pnpm test:scripts
```

## API Package (`apps/api`)

```bash
pnpm --filter @qubeless/api run test:unit
pnpm --filter @qubeless/api run test
pnpm --filter @qubeless/api run test:auth-local
pnpm --filter @qubeless/api run test:oidc-mapping
pnpm --filter @qubeless/api run test:saml-mapping
pnpm --filter @qubeless/api run test:logout
pnpm --filter @qubeless/api run test:sso-optional
pnpm --filter @qubeless/api run test:security
```

## E2E Package (`tests/e2e`)

```bash
cd tests/e2e
pnpm test
pnpm test:quick
pnpm test:auth
pnpm test:projects
pnpm test:analyses
pnpm test:sso
pnpm test:health
pnpm test:audit
pnpm test:rbac
```

## Web Package (`apps/web`)

```bash
cd apps/web
pnpm cypress:run
pnpm cypress:demo
```
