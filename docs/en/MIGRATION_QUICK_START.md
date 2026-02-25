# Quick Start Guide - Qubeless Migration

Quick start guide for Qubeless database migrations.

## Installation

### Prerequisites

```bash
# Install PostgreSQL client (if not already done)
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql-client

# Verify
psql --version
```

## Quick Usage

### 1. Before Migration - Mandatory Backup

```bash
# Create a full backup
./scripts/backup.sh

# Verify the backup
ls -lh backups/
```

### 2. Apply Migrations

```bash
# Interactive mode (recommended for first time)
./scripts/migrate.sh

# The script will:
# ✓ Check dependencies
# ✓ Check DB connection
# ✓ Check that a recent backup exists (<24h)
# ✓ Display migrations to apply
# ✓ Ask for confirmation
# ✓ Apply migrations
# ✓ Display rollback information
```

### 3. Verification

```bash
# Check migration status
npx prisma migrate status --schema=apps/api/prisma/schema.prisma

# Should display: "Database schema is up to date!"
```

## Usage Modes

### Development Mode

```bash
# With confirmations
./scripts/migrate.sh
```

### Production Mode

```bash
# 1. ALWAYS backup first
./scripts/backup.sh

# 2. Simulation (dry-run)
DRY_RUN=true ./scripts/migrate.sh

# 3. Actual application
./scripts/migrate.sh
```

### CI/CD Mode

```bash
# Automatic without confirmations
FORCE_MODE=true SKIP_BACKUP_CHECK=true ./scripts/migrate.sh
```

### Simulation

```bash
# See what will happen without applying
DRY_RUN=true ./scripts/migrate.sh
```

## Available Options

```bash
./scripts/migrate.sh [OPTIONS]

Options:
  -h, --help              Display help
  -f, --force             Force mode (no confirmations)
  -s, --skip-backup       Skip backup verification
  -d, --dry-run           Simulate without applying

Environment variables:
  FORCE_MODE=true         Force mode
  SKIP_BACKUP_CHECK=true  Skip backup verification
  DRY_RUN=true            Simulation
  POSTGRES_HOST=...       PostgreSQL host
  POSTGRES_PORT=...       PostgreSQL port
  POSTGRES_DB=...         Database
```

## In Case of Issues

### Full Rollback (Recommended)

```bash
# 1. Stop services
docker-compose -f docker-compose.dev.yml stop

# 2. Identify the backup
ls -lht backups/

# 3. Restore
./scripts/restore.sh backups/20250126_120000

# 4. Verify
npx prisma migrate status --schema=apps/api/prisma/schema.prisma
```

### Migration Fails

```bash
# 1. Check logs
npx prisma migrate status --schema=apps/api/prisma/schema.prisma

# 2. If needed, restore the backup
./scripts/restore.sh backups/LATEST

# 3. Analyze the issue
docker-compose -f docker-compose.dev.yml logs postgres
```

### Backup Too Old

```bash
# If the backup is more than 24h old, create a new one
./scripts/backup.sh

# Then restart the migration
./scripts/migrate.sh
```

## Complete Update Workflow

```bash
# 1. Backup
./scripts/backup.sh

# 2. Stop services
docker-compose -f docker-compose.dev.yml stop

# 3. Apply migrations
./scripts/migrate.sh

# 4. Update code
git pull origin main

# 5. Install dependencies
pnpm install

# 6. Build
pnpm build

# 7. Restart services
docker-compose -f docker-compose.dev.yml up -d

# 8. Verify
curl http://localhost:3001/health
```

## Practical Examples

### Example 1: First Migration

```bash
# Create a backup
./scripts/backup.sh
# Output: Backup created in backups/20250126_143022/

# Apply the migration
./scripts/migrate.sh
# Follow the on-screen instructions
# Confirm with 'y' when asked

# Verify
npx prisma migrate status --schema=apps/api/prisma/schema.prisma
# Output: Database schema is up to date!
```

### Example 2: Production Migration

```bash
# 1. Backup
./scripts/backup.sh

# 2. Test in simulation
DRY_RUN=true ./scripts/migrate.sh
# Check the output

# 3. Actual application
./scripts/migrate.sh
# Confirm

# 4. In case of issues
./scripts/restore.sh backups/20250126_143022
```

### Example 3: CI/CD Pipeline

```bash
#!/bin/bash
set -e

# Backup (optional in CI if test DB)
SKIP_BACKUP_CHECK=true ./scripts/backup.sh || true

# Automatic migration
FORCE_MODE=true SKIP_BACKUP_CHECK=true ./scripts/migrate.sh

# Tests
pnpm test

# Deployment
./scripts/deploy.sh
```

## Useful Commands

```bash
# Check migration status
npx prisma migrate status --schema=apps/api/prisma/schema.prisma

# List available backups
ls -lht backups/

# Check DB connection
PGPASSWORD=postgres psql -h localhost -U postgres -d qubeless -c "SELECT version();"

# See available migrations
ls -la apps/api/prisma/migrations/

# Test the script
node scripts/test-migrate.js
```

## Migration Checklist

Before each migration:

- [ ] Backup created and verified
- [ ] Services stopped (production)
- [ ] Migration tested in dev/staging
- [ ] Maintenance window scheduled (if prod)
- [ ] Rollback plan prepared

During migration:

- [ ] Read script messages carefully
- [ ] Check migrations to apply
- [ ] Confirm only if everything is correct

After migration:

- [ ] Verify status with `prisma migrate status`
- [ ] Test critical features
- [ ] Check logs
- [ ] Keep backup for at least 7 days

## Help and Documentation

- **Complete guide**: [docs/upgrade.md](upgrade.md)
- **Backup/Restore**: [docs/backup-restore.md](backup-restore.md)
- **Script help**: `./scripts/migrate.sh --help`
- **Available scripts**: [scripts/README.md](../../scripts/README.md)

## Support

In case of issues:

1. Check [docs/upgrade.md](upgrade.md) section "Troubleshooting"
2. Check logs: `docker-compose -f docker-compose.dev.yml logs postgres`
3. Check status: `npx prisma migrate status`
4. As a last resort: restore the backup

---

**Last updated:** 2025-12-26
