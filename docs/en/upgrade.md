# Qubeless Update Guide

This document describes the complete and secure procedure for updating the Qubeless application, including database migrations and application deployments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Process Overview](#process-overview)
- [Update Procedure](#update-procedure)
- [Rollback Strategy](#rollback-strategy)
- [Common Scenarios](#common-scenarios)
- [Troubleshooting](#troubleshooting)
- [Update Checklist](#update-checklist)

---

## Prerequisites

### Before Any Update

#### 1. Required Tools

```bash
# PostgreSQL client for backups/restore
psql --version

# MinIO client for file backups
mc --version

# Node.js and pnpm for Prisma migrations
node --version
pnpm --version

# Git for version management
git --version
```

**Installing missing tools:**

```bash
# Ubuntu/Debian
sudo apt-get install postgresql-client

# macOS
brew install postgresql minio-mc

# MinIO client (all platforms)
# See: https://min.io/docs/minio/linux/reference/minio-mc.html

# Node.js and pnpm
# See: https://nodejs.org/ and https://pnpm.io/
```

#### 2. Mandatory Backup

**IMPORTANT:** Never perform an update without a recent backup.

```bash
# Execute a complete backup
./scripts/backup.sh

# Verify the backup was created
ls -lh backups/
```

The migration script automatically verifies that a backup less than 24 hours old exists.

#### 3. Access and Permissions

- SSH/console access to the server
- Sudo permissions if necessary
- Access to the PostgreSQL database
- Access to MinIO storage
- Configured environment variables

#### 4. Maintenance Window

- Schedule a maintenance window
- Notify users if applicable
- Prepare a communication plan
- Allow time for potential rollback (2x estimated time)

---

## Process Overview

### Update Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    UPDATE PROCESS                           │
└─────────────────────────────────────────────────────────────┘

1. PREPARATION
   ├─ Prerequisites verification
   ├─ Complete backup (PostgreSQL + MinIO)
   ├─ Disk space verification
   └─ New version retrieval

2. SERVICE SHUTDOWN
   ├─ Application shutdown (web, api, worker)
   ├─ Verification that all processes are stopped
   └─ Maintenance mode activated (optional)

3. DATABASE MIGRATION
   ├─ DB connection verification
   ├─ Migration status verification
   ├─ Migration application (prisma migrate deploy)
   └─ Post-migration verification

4. CODE UPDATE
   ├─ Pull/deployment of new code
   ├─ Dependencies installation (pnpm install)
   ├─ Applications build (pnpm build)
   └─ Configuration updates if necessary

5. SERVICE RESTART
   ├─ API startup
   ├─ Worker startup
   ├─ Web startup
   └─ Health checks verification

6. VERIFICATION
   ├─ Health checks
   ├─ Critical functional tests
   ├─ Logs verification
   └─ Metrics monitoring

7. FINALIZATION
   ├─ Changes documentation
   ├─ End of maintenance notification
   └─ Old backup cleanup (optional)
```

### Critical Order of Operations

**⚠️ IMPORTANT: Strictly follow this order**

1. **BACKUP FIRST** - Always make a backup before any other operation
2. **STOP SERVICES** - Stop all services before DB migration
3. **MIGRATE DB** - Apply migrations before deploying new code
4. **UPDATE CODE** - Deploy new code after DB migrations
5. **START SERVICES** - Restart in order: API → Worker → Web
6. **VERIFY** - Test before considering the update complete

---

## Update Procedure

### Step 1: Preparation

#### 1.1 Verify Prerequisites

```bash
# Check available disk space
df -h

# Recommended minimum:
# - 5 GB for backups
# - 2 GB for builds
# - 1 GB for temporary logs

# Check current version
cd /path/to/qubeless
git branch
git log -1
```

#### 1.2 Execute Backup

```bash
# Complete backup
./scripts/backup.sh

# Verify the backup
BACKUP_DIR=$(ls -td backups/202* | head -1)
echo "Backup created: $BACKUP_DIR"
ls -lh "$BACKUP_DIR"

# Verify PostgreSQL dump integrity
gunzip -t "$BACKUP_DIR"/postgres_*.sql.gz
echo "PostgreSQL backup: OK"

# Verify MinIO archive
tar -tzf "$BACKUP_DIR"/minio.tar.gz > /dev/null
echo "MinIO backup: OK"
```

#### 1.3 Retrieve New Version

```bash
# Fetch latest changes
git fetch origin

# Check target version
git log origin/main --oneline -10

# Check upcoming migrations
git diff HEAD origin/main -- apps/api/prisma/migrations/
```

### Step 2: Service Shutdown

#### 2.1 Maintenance Mode (Optional)

```bash
# If using a reverse proxy (nginx, traefik, etc.)
# Enable a maintenance page

# Example with nginx
sudo cp /etc/nginx/maintenance.conf /etc/nginx/sites-enabled/qubeless
sudo nginx -s reload
```

#### 2.2 Service Shutdown

```bash
# With Docker Compose
docker-compose -f docker-compose.dev.yml stop

# Verify all containers are stopped
docker-compose -f docker-compose.dev.yml ps

# Or with systemd
sudo systemctl stop qubeless-web
sudo systemctl stop qubeless-api
sudo systemctl stop qubeless-worker

# Verify shutdown
sudo systemctl status qubeless-*
```

#### 2.3 Verification

```bash
# Verify no Node processes are running
ps aux | grep node

# Verify no DB connections are active (except yours)
PGPASSWORD=postgres psql -h localhost -U postgres -d qubeless -c "SELECT count(*) FROM pg_stat_activity WHERE datname='qubeless';"
```

### Step 3: Database Migration

#### 3.1 Verify Current State

```bash
# Verify connection
PGPASSWORD=postgres psql -h localhost -U postgres -d qubeless -c "SELECT version();"

# Verify migration status
npx prisma migrate status --schema=apps/api/prisma/schema.prisma
```

#### 3.2 Execute Migrations

```bash
# Option 1: Interactive mode (recommended in production)
./scripts/migrate.sh

# The script will:
# 1. Verify dependencies
# 2. Verify DB connection
# 3. Verify a recent backup exists
# 4. Display migrations to apply
# 5. Ask for confirmation
# 6. Apply migrations
# 7. Verify result

# Option 2: Automatic mode (CI/CD)
FORCE_MODE=true SKIP_BACKUP_CHECK=true ./scripts/migrate.sh

# Option 3: Simulation (dry-run)
DRY_RUN=true ./scripts/migrate.sh
```

#### 3.3 Post-Migration Verification

```bash
# Verify all migrations are applied
npx prisma migrate status --schema=apps/api/prisma/schema.prisma

# Should display: "Database schema is up to date!"

# Verify some critical tables
PGPASSWORD=postgres psql -h localhost -U postgres -d qubeless -c "\dt"

# Verify data (examples)
PGPASSWORD=postgres psql -h localhost -U postgres -d qubeless -c "SELECT count(*) FROM users;"
PGPASSWORD=postgres psql -h localhost -U postgres -d qubeless -c "SELECT count(*) FROM projects;"
```

### Step 4: Code Update

#### 4.1 Deploy New Version

```bash
# Pull new version
git pull origin main

# Or checkout a specific tag
git checkout v1.2.0

# Verify version
git log -1
```

#### 4.2 Install Dependencies

```bash
# Install/update dependencies
pnpm install

# Clean cache if necessary
pnpm store prune
```

#### 4.3 Build Applications

```bash
# Complete build
pnpm build

# Or by package
pnpm --filter @qubeless/shared build
pnpm --filter @qubeless/api build
pnpm --filter @qubeless/worker build
pnpm --filter @qubeless/web build

# Verify builds are created
ls -lh apps/api/dist/
ls -lh apps/worker/dist/
ls -lh apps/web/dist/
```

#### 4.4 Update Configurations

```bash
# Check if new environment variables are needed
git diff HEAD~1 docs/en/deploy.md

# Update .env.production if necessary
nano .env.production

# Verify Prisma configuration
npx prisma generate --schema=apps/api/prisma/schema.prisma
```

### Step 5: Service Restart

#### 5.1 Sequential Startup

```bash
# With Docker Compose
docker-compose -f docker-compose.dev.yml up -d

# Or with systemd (in order)
sudo systemctl start qubeless-api
sleep 5  # Wait for API to be ready

sudo systemctl start qubeless-worker
sleep 5

sudo systemctl start qubeless-web
```

#### 5.2 Logs Verification

```bash
# Docker Compose
docker-compose -f docker-compose.dev.yml logs -f --tail=100

# Or systemd
sudo journalctl -u qubeless-api -f
sudo journalctl -u qubeless-worker -f
sudo journalctl -u qubeless-web -f

# Search for errors
docker-compose -f docker-compose.dev.yml logs | grep -i error
docker-compose -f docker-compose.dev.yml logs | grep -i exception
```

### Step 6: Verification

#### 6.1 Health Checks

```bash
# API Health Check
curl http://localhost:3001/health
# Expected: {"status":"ok"}

# Worker Health Check
curl http://localhost:3001/health
# Expected: {"status":"ok"}

# Web (verify page loads)
curl -I http://localhost:4000
# Expected: HTTP/1.1 200 OK
```

#### 6.2 Functional Tests

```bash
# Test authentication
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Test project creation (with token)
curl -X POST http://localhost:3001/api/projects \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Project"}'

# Test worker (verify it processes jobs)
docker-compose -f docker-compose.dev.yml logs worker | grep "Processing job"
```

#### 6.3 Database Verification

```bash
# Verify active connections
PGPASSWORD=postgres psql -h localhost -U postgres -d qubeless -c "SELECT count(*) FROM pg_stat_activity WHERE datname='qubeless';"

# Verify no recent errors in logs
docker-compose -f docker-compose.dev.yml logs postgres | grep -i error | tail -20
```

#### 6.4 Monitoring

```bash
# Prometheus metrics (if configured)
curl http://localhost:9090/metrics

# Check key metrics
curl http://localhost:9090/metrics | grep qubeless_http_requests_total
curl http://localhost:9090/metrics | grep qubeless_jobs_processed_total
```

### Step 7: Finalization

#### 7.1 Disable Maintenance Mode

```bash
# Nginx
sudo rm /etc/nginx/sites-enabled/maintenance.conf
sudo nginx -s reload
```

#### 7.2 Documentation

```bash
# Document the update
cat >> CHANGELOG.md <<EOF

## $(date +%Y-%m-%d) - v1.2.0

### Update
- Applied migrations: [list of migrations]
- New features: [description]
- Bug fixes: [list]

### Operations
- Backup: backups/$(ls -t backups/ | head -1)
- Maintenance duration: [duration]
- Status: ✅ Success

EOF
```

#### 7.3 Cleanup (Optional)

```bash
# Clean old backups (keep last 7)
cd backups/
ls -t | tail -n +8 | xargs -r rm -rf

# Clean Docker logs
docker system prune -f
```

---

## Rollback Strategy

### Rollback Principles

**⚠️ IMPORTANT:**

- Prisma does **NOT** support automatic migration rollback
- Rollback is a **best-effort** process
- Complete restoration from backup is the safest method
- Test the rollback process in pre-production

### Option 1: Complete Restoration (Recommended)

**When to use:**

- DB migration failed
- Data corruption detected
- Unexpected behavior after migration
- When in doubt

**Procedure:**

```bash
# 1. Stop all services
docker-compose -f docker-compose.dev.yml stop

# 2. Identify backup to restore
ls -lth backups/
BACKUP_DIR="backups/20231215_143022"  # Replace with your backup

# 3. Restore from backup
./scripts/restore.sh "$BACKUP_DIR"

# The script will:
# - Verify backup exists
# - Restore PostgreSQL (DROP + RESTORE)
# - Restore MinIO
# - Verify integrity

# 4. Revert to previous code
git reset --hard HEAD~1  # Or the previous commit

# 5. Rebuild
pnpm install
pnpm build

# 6. Restart services
docker-compose -f docker-compose.dev.yml up -d

# 7. Verify
./scripts/migrate.sh -d  # Dry-run to verify state
```

### Option 2: Manual Reverse Migration

**When to use:**

- Simple and reversible migration
- No acceptable data loss
- Need to keep data created since migration

**Procedure:**

```bash
# 1. Identify migration to rollback
npx prisma migrate status --schema=apps/api/prisma/schema.prisma

# 2. Create reverse migration
# Example: if migration added a column
# Manually create a migration SQL file

cat > apps/api/prisma/migrations/rollback_add_column/migration.sql <<EOF
-- Rollback: Remove the column added in previous migration
ALTER TABLE users DROP COLUMN IF EXISTS new_column;
EOF

# 3. Apply reverse migration
npx prisma migrate resolve --applied rollback_add_column --schema=apps/api/prisma/schema.prisma

# 4. Execute SQL manually
PGPASSWORD=postgres psql -h localhost -U postgres -d qubeless \
  -f apps/api/prisma/migrations/rollback_add_column/migration.sql

# 5. Verify
npx prisma migrate status --schema=apps/api/prisma/schema.prisma
```

### Option 3: Complete Reset (LAST RESORT)

**⚠️ DANGER: TOTAL DATA LOSS**

```bash
# NEVER USE IN PRODUCTION WITHOUT BACKUP

# Complete database reset
npx prisma migrate reset --schema=apps/api/prisma/schema.prisma

# Restore data from backup
./scripts/restore.sh "$BACKUP_DIR"
```

### Rollback Decision Matrix

| Situation                       | Recommended Action           | Data Loss |
| ------------------------------- | ---------------------------- | --------- |
| Failed migration                | Complete restoration         | No        |
| Corrupted data                  | Complete restoration         | No        |
| Application bug (DB OK)         | Code rollback only           | No        |
| Migration OK but functional bug | Reverse migration + code fix | Depends   |
| Test/development                | Reset + restore              | N/A       |

---

## Common Scenarios

### Scenario 1: Minor Update (Patch)

**Example: v1.2.0 → v1.2.1 (bug fixes, no DB migration)**

```bash
# 1. Backup as precaution
./scripts/backup.sh

# 2. Stop services
docker-compose -f docker-compose.dev.yml stop

# 3. Pull new version
git pull origin main

# 4. Rebuild only (no pnpm install if deps unchanged)
pnpm build

# 5. Restart
docker-compose -f docker-compose.dev.yml up -d

# 6. Verify
curl http://localhost:3001/health
```

**Estimated duration:** 5-10 minutes

### Scenario 2: Major Update with Migrations

**Example: v1.2.0 → v2.0.0 (new features, DB migrations)**

```bash
# 1. Backup (mandatory)
./scripts/backup.sh

# 2. Stop all services
docker-compose -f docker-compose.dev.yml stop

# 3. Check upcoming migrations
git fetch origin
git diff HEAD origin/main -- apps/api/prisma/migrations/

# 4. Apply migrations
./scripts/migrate.sh

# 5. Pull new version
git pull origin main

# 6. Install new dependencies
pnpm install

# 7. Complete rebuild
pnpm build

# 8. Restart
docker-compose -f docker-compose.dev.yml up -d

# 9. Complete tests
pnpm test:e2e

# 10. Verify metrics
curl http://localhost:9090/metrics
```

**Estimated duration:** 20-30 minutes

### Scenario 3: Production Update (Zero Downtime)

**Blue-Green Deployment Strategy**

```bash
# 1. Prepare Green environment (clone)
# On a new server or container

# 2. Deploy new version on Green
git clone <repo> qubeless-green
cd qubeless-green
git checkout v2.0.0

# 3. Configure Green to use same DB
cp ../qubeless-blue/.env .env
# Adjust ports to avoid conflicts

# 4. DB backup
./scripts/backup.sh

# 5. Apply migrations (shared DB)
./scripts/migrate.sh

# 6. Build and start Green
pnpm install
pnpm build
docker-compose -f docker-compose.dev.yml up -d

# 7. Test Green
curl http://localhost:3010/health

# 8. Switch traffic (load balancer / nginx)
# Blue (old) → Green (new)

# 9. Monitor Green

# 10. Stop Blue if all is well
cd ../qubeless-blue
docker-compose -f docker-compose.dev.yml stop
```

**Estimated duration:** 30-45 minutes + monitoring

### Scenario 4: Emergency Rollback

```bash
# 1. Stop services immediately
docker-compose -f docker-compose.dev.yml stop

# 2. Identify last backup
BACKUP=$(ls -td backups/202* | head -1)
echo "Restoring from: $BACKUP"

# 3. Restore
./scripts/restore.sh "$BACKUP"

# 4. Revert to previous code
git reset --hard <previous-commit>

# 5. Rebuild
pnpm build

# 6. Restart
docker-compose -f docker-compose.dev.yml up -d

# 7. Verify
curl http://localhost:3001/health

# 8. Analyze logs to understand the problem
docker-compose -f docker-compose.dev.yml logs > incident-$(date +%Y%m%d_%H%M%S).log
```

**Estimated duration:** 10-15 minutes

---

## Troubleshooting

### Problem: Migration Fails

**Symptoms:**

```
Error: Migration failed to apply
```

**Solutions:**

```bash
# 1. Check detailed logs
npx prisma migrate status --schema=apps/api/prisma/schema.prisma

# 2. Verify DB connection
PGPASSWORD=postgres psql -h localhost -U postgres -d qubeless -c "SELECT 1;"

# 3. Check partially applied migrations
PGPASSWORD=postgres psql -h localhost -U postgres -d qubeless -c "SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;"

# 4. Mark migration as failed and retry
npx prisma migrate resolve --rolled-back <migration-name> --schema=apps/api/prisma/schema.prisma
./scripts/migrate.sh

# 5. If problem persists: complete rollback
./scripts/restore.sh <backup>
```

### Problem: Services Won't Start

**Symptoms:**

```
Container exits immediately
Health check fails
```

**Solutions:**

```bash
# 1. Check logs
docker-compose -f docker-compose.dev.yml logs api
docker-compose -f docker-compose.dev.yml logs worker

# 2. Verify environment variables
docker-compose -f docker-compose.dev.yml config

# 3. Verify DB connection from container
docker-compose -f docker-compose.dev.yml exec api sh
npx prisma db pull --schema=/app/prisma/schema.prisma

# 4. Verify ports
netstat -tulpn | grep :3001

# 5. Rebuild images if necessary
docker-compose -f docker-compose.dev.yml build --no-cache
docker-compose -f docker-compose.dev.yml up -d
```

### Problem: Backup Too Old

**Symptoms:**

```
[WARNING] Backup is more than 24 hours old
```

**Solutions:**

```bash
# 1. Create new backup
./scripts/backup.sh

# 2. Or force migration (risky)
FORCE_MODE=true ./scripts/migrate.sh

# 3. Or skip verification (very risky)
SKIP_BACKUP_CHECK=true ./scripts/migrate.sh
```

### Problem: Insufficient Disk Space

**Symptoms:**

```
No space left on device
```

**Solutions:**

```bash
# 1. Check space
df -h

# 2. Clean old backups
cd backups/
ls -t | tail -n +5 | xargs -r rm -rf

# 3. Clean Docker
docker system prune -a -f --volumes

# 4. Clean logs
sudo journalctl --vacuum-time=7d

# 5. Clean node_modules
find . -name "node_modules" -type d -prune -exec rm -rf '{}' +
pnpm install
```

### Problem: Migration Conflicts

**Symptoms:**

```
Migration conflict detected
```

**Solutions:**

```bash
# 1. Verify state
npx prisma migrate status --schema=apps/api/prisma/schema.prisma

# 2. Resolve manually
# Identify conflicting migrations
ls -la apps/api/prisma/migrations/

# 3. Mark as resolved
npx prisma migrate resolve --applied <migration-name> --schema=apps/api/prisma/schema.prisma

# 4. If Git conflict
git fetch origin
git merge --strategy-option theirs origin/main
npx prisma migrate dev --name merge_migrations
```

---

## Update Checklist

### Before Update

- [ ] Read release notes (changelog)
- [ ] Identify migrations to apply
- [ ] Verify available disk space (≥ 10 GB)
- [ ] Verify all tools are installed
- [ ] Schedule maintenance window
- [ ] Notify users (if applicable)
- [ ] Prepare rollback plan
- [ ] Test procedure in pre-production

### During Update

- [ ] Execute complete backup (`./scripts/backup.sh`)
- [ ] Verify backup integrity
- [ ] Stop all services
- [ ] Verify all processes are stopped
- [ ] Apply DB migrations (`./scripts/migrate.sh`)
- [ ] Verify migration results
- [ ] Deploy new code
- [ ] Install dependencies (`pnpm install`)
- [ ] Build applications (`pnpm build`)
- [ ] Verify builds
- [ ] Update configurations if necessary
- [ ] Restart services in order
- [ ] Verify startup logs

### After Update

- [ ] Execute health checks
- [ ] Test critical functionalities
- [ ] Verify database
- [ ] Review metrics
- [ ] Monitor logs (minimum 15 minutes)
- [ ] Test complete user workflow
- [ ] Disable maintenance mode
- [ ] Notify end of maintenance
- [ ] Document update
- [ ] Archive backup
- [ ] Schedule enhanced monitoring (24h)

### In Case of Problem

- [ ] Keep error logs
- [ ] Assess severity
- [ ] Decide: fix forward or rollback
- [ ] If rollback: execute `./scripts/restore.sh`
- [ ] Document incident
- [ ] Analyze root cause
- [ ] Plan new attempt

---

## Automation Script Examples

### Complete Update Script

```bash
#!/usr/bin/env bash
# update.sh - Complete update script

set -euo pipefail

VERSION="$1"
ENVIRONMENT="${2:-production}"

echo "=== Qubeless Update to $VERSION ($ENVIRONMENT) ==="

# 1. Backup
echo "Step 1: Backup"
./scripts/backup.sh

# 2. Stop services
echo "Step 2: Stop services"
docker-compose -f docker-compose.dev.yml stop

# 3. Update code
echo "Step 3: Update code"
git fetch origin
git checkout "$VERSION"

# 4. Migrate DB
echo "Step 4: Migrate database"
FORCE_MODE=true ./scripts/migrate.sh

# 5. Install dependencies
echo "Step 5: Install dependencies"
pnpm install

# 6. Build
echo "Step 6: Build applications"
pnpm build

# 7. Start services
echo "Step 7: Start services"
docker-compose -f docker-compose.dev.yml up -d

# 8. Wait and verify
echo "Step 8: Verification"
sleep 10
curl -f http://localhost:3001/health || {
    echo "Health check failed! Rolling back..."
    ./scripts/restore.sh "$(ls -td backups/202* | head -1)"
    exit 1
}

echo "=== Update completed successfully ==="
```

### Pre-Update Checks Script

```bash
#!/usr/bin/env bash
# pre-update-check.sh - Pre-update verifications

set -euo pipefail

echo "=== Pre-Update Checks ==="

# Check disk space
AVAILABLE=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')
if [ "$AVAILABLE" -lt 10 ]; then
    echo "❌ Insufficient disk space: ${AVAILABLE}GB (10GB required)"
    exit 1
fi
echo "✅ Disk space: ${AVAILABLE}GB"

# Check database connection
if PGPASSWORD=postgres psql -h localhost -U postgres -d qubeless -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Database connection"
else
    echo "❌ Database connection failed"
    exit 1
fi

# Check recent backup
LATEST_BACKUP=$(ls -td backups/202* 2>/dev/null | head -1 || echo "")
if [ -z "$LATEST_BACKUP" ]; then
    echo "❌ No backup found"
    exit 1
fi

BACKUP_AGE=$(( ($(date +%s) - $(stat -f %m "$LATEST_BACKUP" 2>/dev/null || stat -c %Y "$LATEST_BACKUP")) / 3600 ))
if [ "$BACKUP_AGE" -gt 24 ]; then
    echo "⚠️  Backup is ${BACKUP_AGE}h old (>24h)"
else
    echo "✅ Recent backup: ${BACKUP_AGE}h old"
fi

# Check tools
for cmd in psql mc npx pnpm docker-compose; do
    if command -v $cmd > /dev/null; then
        echo "✅ $cmd installed"
    else
        echo "❌ $cmd not found"
        exit 1
    fi
done

echo "=== All checks passed ==="
```
