# E2E Tests Configuration

This guide explains how to set up and run E2E tests for Qubeless.

## Prerequisites

E2E tests require the entire system to be running:

1. **PostgreSQL** - Database
2. **Redis** - Queue and cache
3. **MinIO** - S3 storage (optional for some tests)
4. **API** - Qubeless API
5. **Worker** - Analysis worker (optional)

## Quick Setup with Docker Compose

### 1. Start the Services

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up -d

# Verify that services are running
docker-compose -f docker-compose.dev.yml ps
```

Services started:

- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- MinIO: `localhost:9000`
- API: `localhost:3001`
- Web: `localhost:8081`

### 2. Wait for the API to Be Ready

```bash
# Check the health check
curl http://localhost:3001/api/health

# Should return: {"status":"ok","timestamp":"..."}
```

### 3. Run E2E Tests

```bash
pnpm test:e2e
```

## Manual Configuration (Local Development)

If you are developing without Docker, follow these steps:

### 1. Start PostgreSQL

```bash
# Via Docker
docker run -d \
  --name qubeless-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=qubeless \
  -p 5432:5432 \
  postgres:15-alpine

# Or via your local installation
pg_ctl start
createdb qubeless
```

### 2. Start Redis

```bash
# Via Docker
docker run -d \
  --name qubeless-redis \
  -p 6379:6379 \
  redis:7-alpine

# Or via your local installation
redis-server
```

### 3. Start MinIO (Optional)

```bash
# Via Docker
docker run -d \
  --name qubeless-minio \
  -e MINIO_ROOT_USER=minio \
  -e MINIO_ROOT_PASSWORD=minio123 \
  -p 9000:9000 \
  -p 9001:9001 \
  minio/minio server /data --console-address ":9001"
```

### 4. Configure Environment Variables

```bash
cd apps/api
touch .env
```

Edit `.env`:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/qubeless
REDIS_HOST=localhost
REDIS_PORT=6379
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minio
MINIO_SECRET_KEY=minio123
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
JWT_SECRET=super-secret-change-me
```

### 5. Run Migrations

```bash
cd apps/api
pnpm prisma migrate deploy
# or
pnpm prisma migrate dev
```

### 6. Create Admin User

The API automatically creates the admin user on startup if the `ADMIN_EMAIL` and `ADMIN_PASSWORD` variables are set.

### 7. Start the API

```bash
cd apps/api
pnpm dev
```

Verify that the API is accessible:

```bash
curl http://localhost:3001/api/health
```

### 8. Run E2E Tests

```bash
pnpm test:e2e
```

## E2E Tests Configuration

E2E tests can be configured via environment variables:

```bash
# tests/e2e/.env
API_URL=http://localhost:3001/api
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
```

Or directly in the command:

```bash
API_URL=http://localhost:3001/api \
ADMIN_EMAIL=admin@example.com \
ADMIN_PASSWORD=admin123 \
pnpm test:e2e
```

## Troubleshooting

### Error: "Login failed - Status: 500"

**Possible causes:**

1. The database is not accessible
2. Migrations have not been applied
3. The admin user does not exist

**Solutions:**

```bash
# Check the database connection
psql postgresql://postgres:postgres@localhost:5432/qubeless -c "SELECT 1"

# Reapply migrations
cd apps/api
pnpm prisma migrate deploy

# Check the API logs
# If the API is running in dev: look at the console
# If the API is running in Docker: docker-compose -f docker-compose.dev.yml logs api
```

### Error: "API is not healthy"

**Causes:**

- The API is not started
- The API is on a different port
- The API URL is incorrect

**Solutions:**

```bash
# Check that the API is listening on the correct port
curl http://localhost:3001/api/health

# Check Docker services
docker-compose -f docker-compose.dev.yml ps

# Restart the API
docker-compose -f docker-compose.dev.yml restart api
# or
cd apps/api && pnpm dev
```

### Error: "Connection refused"

**Causes:**

- PostgreSQL is not started
- Redis is not started
- Ports already in use

**Solutions:**

```bash
# Check services
docker-compose -f docker-compose.dev.yml ps
netstat -an | grep 5432  # PostgreSQL
netstat -an | grep 6379  # Redis
netstat -an | grep 3001  # API

# Restart all services
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up -d
```

### Error: "Cannot create user - Email already exists"

**Solution:**
The admin user already exists. This is normal, the tests will use this user.

### Slow Tests or Timeout

**Solutions:**

```bash
# Use quick mode (skip some tests)
pnpm test:e2e:quick

# Increase the timeout in E2E tests
# Edit tests/e2e/index.js and increase the axios timeouts
```

## Tests by Suite

You can run specific suites:

```bash
# Authentication only
pnpm test:e2e:auth

# Projects only
pnpm test:e2e:projects

# Analyses only
pnpm test:e2e:analyses

# Health & Monitoring
cd tests/e2e && pnpm test:health

# Audit
cd tests/e2e && pnpm test:audit

# RBAC
cd tests/e2e && pnpm test:rbac
```

## CI/CD

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: qubeless
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run migrations
        run: |
          cd apps/api
          pnpm prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/qubeless

      - name: Build API
        run: |
          cd apps/api
          pnpm build

      - name: Start API (background)
        run: |
          cd apps/api
          pnpm start &
          sleep 10
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/qubeless
          REDIS_HOST: localhost
          ADMIN_EMAIL: admin@example.com
          ADMIN_PASSWORD: admin123

      - name: Run E2E Tests
        run: pnpm test:e2e
        env:
          API_URL: http://localhost:3001/api
          ADMIN_EMAIL: admin@example.com
          ADMIN_PASSWORD: admin123
```

## Checklist Before Running Tests

- [ ] PostgreSQL is started and accessible
- [ ] Redis is started
- [ ] Migrations are applied
- [ ] The API is started
- [ ] The `/api/health` endpoint returns `{"status":"ok"}`
- [ ] Environment variables are correct
- [ ] The admin user exists (or will be created on API startup)

## Commands Summary

```bash
# Complete setup with Docker Compose
docker-compose -f docker-compose.dev.yml up -d
pnpm test:e2e

# Manual setup
docker run -d --name qubeless-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=qubeless -p 5432:5432 postgres:15-alpine
docker run -d --name qubeless-redis -p 6379:6379 redis:7-alpine
cd apps/api && pnpm prisma migrate deploy && pnpm dev &
pnpm test:e2e

# Verification
curl http://localhost:3001/api/health
```

## Support

If you encounter issues:

1. Check the API logs
2. Verify that all services are started
3. Check environment variables
4. See the Troubleshooting section above
5. Open an issue on GitHub with the logs

## Additional Documentation

- [Testing Guide](./testing.md)
- [Docker Configuration](../../docker-compose.dev.yml)
- [Production env variable reference](./deploy.md#envproduction-example)
