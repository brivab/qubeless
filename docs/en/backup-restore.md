# Qubeless Backup and Restore

This document describes how to backup and restore the entire Qubeless system, including the PostgreSQL database and MinIO storage.

## Overview

The backup and restore scripts allow you to:
- **Backup** the PostgreSQL database and MinIO files
- **Restore** the entire system from a backup
- **Migrate** data to a new environment

## Prerequisites

### Tool Installation

#### PostgreSQL Client
```bash
# Ubuntu/Debian
sudo apt-get install postgresql-client

# macOS
brew install postgresql

# Alpine Linux (Docker)
apk add postgresql-client
```

#### MinIO Client
```bash
# Linux
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/

# macOS
brew install minio/stable/mc

# Docker (use official image)
docker pull minio/mc
```

Verification:
```bash
pg_dump --version
mc --version
```

## Backup

### Basic Usage

```bash
./scripts/backup.sh
```

The backup will be created in `./backups/YYYYMMDD_HHMMSS/` with:
- `postgres_qubeless.sql.gz` - Compressed PostgreSQL dump
- `minio.tar.gz` - Archive of MinIO buckets
- `backup_metadata.txt` - Backup metadata

### Configuration via Environment Variables

#### PostgreSQL
```bash
export POSTGRES_HOST=localhost      # PostgreSQL host
export POSTGRES_PORT=5432           # PostgreSQL port
export POSTGRES_USER=postgres       # PostgreSQL user
export POSTGRES_PASSWORD=postgres   # PostgreSQL password
export POSTGRES_DB=qubeless         # Database to backup
```

#### MinIO
```bash
export MINIO_ENDPOINT=http://localhost:9000  # MinIO endpoint
export MINIO_ACCESS_KEY=minio                # MinIO access key
export MINIO_SECRET_KEY=minio123             # MinIO secret key
export MINIO_BUCKET_SOURCES=sources          # Sources bucket
export MINIO_BUCKET_ARTIFACTS=artifacts      # Artifacts bucket
```

#### Backup Directory
```bash
export BACKUP_DIR=/path/to/backups     # Root backup directory
export BACKUP_TIMESTAMP=20250126_120000  # Custom timestamp (optional)
```

### Examples

#### Standard backup (localhost)
```bash
./scripts/backup.sh
```

#### Backup from a remote server
```bash
POSTGRES_HOST=db.example.com \
POSTGRES_PASSWORD=secret123 \
MINIO_ENDPOINT=http://minio.example.com:9000 \
MINIO_SECRET_KEY=secretkey \
./scripts/backup.sh
```

#### Backup to a custom directory
```bash
BACKUP_DIR=/mnt/backups ./scripts/backup.sh
```

#### Backup from Docker Compose
```bash
# Use environment variables from docker-compose.dev.yml
docker-compose -f docker-compose.dev.yml exec postgres pg_dump -U postgres qubeless | gzip > backup.sql.gz

# Or via the script (from the host)
./scripts/backup.sh
```

### Script Output

```
[INFO] === Qubeless Backup Started ===
[INFO] Timestamp: 20250126_143022

[SUCCESS] All dependencies are present
[SUCCESS] Backup directory created: ./backups/20250126_143022
[SUCCESS] MinIO client configured

[INFO] Backing up PostgreSQL (qubeless)...
[SUCCESS] PostgreSQL backed up: ./backups/20250126_143022/postgres_qubeless.sql.gz (2.4M)

[INFO] Backing up MinIO...
[INFO]   - Backing up bucket: sources
[SUCCESS]    Bucket 'sources' backed up: 145M (42 files)
[INFO]   - Backing up bucket: artifacts
[SUCCESS]    Bucket 'artifacts' backed up: 89M (128 files)
[INFO] Compressing MinIO...
[SUCCESS] MinIO compressed: ./backups/20250126_143022/minio.tar.gz (198M)

[SUCCESS] Metadata created: ./backups/20250126_143022/backup_metadata.txt

[SUCCESS] === Backup Completed ===
[INFO] Location: ./backups/20250126_143022
[INFO] Total size: 200M

[INFO] Files created:
  - backup_metadata.txt (573)
  - minio.tar.gz (198M)
  - postgres_qubeless.sql.gz (2.4M)
```

## Restore

### Basic Usage

```bash
./scripts/restore.sh ./backups/20250126_143022
```

### ⚠️ Important Warnings

- **Existing data will be OVERWRITTEN**
- The script requires explicit confirmation (type `yes`)
- Use `FORCE=true` to automate (use with caution)
- Test first on a dev/test environment

### Configuration via Environment Variables

#### Restore Options
```bash
export RESTORE_POSTGRES=true|false   # Restore PostgreSQL (default: true)
export RESTORE_MINIO=true|false      # Restore MinIO (default: true)
export FORCE=true|false              # Force without confirmation (default: false)
```

#### Restore Targets (same variables as backup)
```bash
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=postgres
export POSTGRES_DB=qubeless

export MINIO_ENDPOINT=http://localhost:9000
export MINIO_ACCESS_KEY=minio
export MINIO_SECRET_KEY=minio123
```

### Examples

#### Full restore
```bash
./scripts/restore.sh ./backups/20250126_143022
```

#### PostgreSQL restore only
```bash
RESTORE_MINIO=false ./scripts/restore.sh ./backups/20250126_143022
```

#### MinIO restore only
```bash
RESTORE_POSTGRES=false ./scripts/restore.sh ./backups/20250126_143022
```

#### Restore to another server
```bash
POSTGRES_HOST=prod-db.example.com \
POSTGRES_PASSWORD=prodpassword \
./scripts/restore.sh ./backups/20250126_143022
```

#### Forced restore (without confirmation)
```bash
# WARNING: Use only in automated scripts
FORCE=true ./scripts/restore.sh ./backups/20250126_143022
```

#### Migration to a new environment
```bash
# Restore from a production backup to a staging server
POSTGRES_HOST=staging-db.example.com \
POSTGRES_DB=qubeless_staging \
POSTGRES_PASSWORD=stagingpass \
MINIO_ENDPOINT=http://staging-minio.example.com:9000 \
MINIO_SECRET_KEY=stagingsecret \
./scripts/restore.sh ./backups/prod_20250126_143022
```

### Script Output

```
[INFO] === Qubeless Restore Started ===
[INFO] Backup path: ./backups/20250126_143022

[SUCCESS] All dependencies are present
[INFO] Verifying backup...
[INFO] Metadata found:
  Qubeless Backup Metadata
  ========================
  Date: Thu Jan 26 14:30:22 UTC 2025
  Timestamp: 20250126_143022
  ...

[INFO] Backup contents:
  - backup_metadata.txt (573)
  - minio.tar.gz (198M)
  - postgres_qubeless.sql.gz (2.4M)

╔════════════════════════════════════════════════════════╗
║              ⚠️  IMPORTANT WARNING ⚠️              ║
╚════════════════════════════════════════════════════════╝

[WARNING] This operation will OVERWRITE existing data!

[INFO] PostgreSQL will be restored:
[INFO]   - Database: qubeless
[INFO]   - Host: localhost:5432
[INFO] MinIO will be restored:
[INFO]   - Endpoint: http://localhost:9000
[INFO]   - Buckets: sources, artifacts

Are you sure you want to continue? Type 'yes' to confirm: yes

[SUCCESS] MinIO client configured

[INFO] Restoring PostgreSQL...
[INFO] Dump file: postgres_qubeless.sql.gz
[INFO] Decompressing and restoring...
[SUCCESS] PostgreSQL restored successfully
[INFO] Tables restored: 23

[INFO] Restoring MinIO...
[INFO] MinIO archive: minio.tar.gz
[INFO] Decompressing to /tmp/tmp.X9K2Qw3dkL...
[INFO]   - Restoring bucket: sources
[INFO]     Bucket 'sources' created
[INFO]     Cleaning existing bucket...
[SUCCESS]    Bucket 'sources' restored (42 files)
[INFO]   - Restoring bucket: artifacts
[SUCCESS]    Bucket 'artifacts' restored (128 files)
[SUCCESS] MinIO restored successfully

[SUCCESS] === Restore Completed ===
[INFO] Verify that your application is working correctly
```

## Automation

### Daily automatic backup (cron)

```bash
# Edit the crontab
crontab -e

# Add a line for daily backup at 2 AM
0 2 * * * cd /path/to/qubeless && BACKUP_DIR=/mnt/backups ./scripts/backup.sh >> /var/log/qubeless-backup.log 2>&1
```

### Backup with rotation (keep last 7 days)

```bash
#!/bin/bash
# backup-rotate.sh

# Backup
cd /path/to/qubeless
BACKUP_DIR=/mnt/backups ./scripts/backup.sh

# Delete backups older than 7 days
find /mnt/backups -type d -mtime +7 -name "202*" -exec rm -rf {} +
```

### Remote backup script (SSH)

```bash
#!/bin/bash
# remote-backup.sh

# Backup on remote server
ssh user@server.example.com 'cd /app/qubeless && ./scripts/backup.sh'

# Copy the backup locally
LATEST_BACKUP=$(ssh user@server.example.com 'ls -td /app/qubeless/backups/* | head -1')
scp -r user@server.example.com:$LATEST_BACKUP ./local-backups/
```

## Backup Strategies

### 3-2-1 Backup Rule

The 3-2-1 rule recommends:
- **3** copies of your data
- On **2** different types of media
- **1** copy offsite

Example implementation:
```bash
#!/bin/bash
# Local backup
./scripts/backup.sh

# Copy to a NAS (media 2)
rsync -av ./backups/ /mnt/nas/qubeless-backups/

# Copy to the cloud (offsite)
rclone sync ./backups/ remote:qubeless-backups/
```

### Incremental Backup

For more frequent and space-efficient backups:

```bash
# Full weekly backup
0 2 * * 0 ./scripts/backup.sh

# Daily incremental backup (PostgreSQL only)
0 2 * * 1-6 RESTORE_MINIO=false ./scripts/backup.sh
```

## Verification and Testing

### Test a backup

```bash
# 1. Create a backup
./scripts/backup.sh

# 2. Verify the contents
BACKUP_PATH=$(ls -td ./backups/* | head -1)
cat $BACKUP_PATH/backup_metadata.txt

# 3. Test decompression
gunzip -t $BACKUP_PATH/postgres_*.sql.gz
tar -tzf $BACKUP_PATH/minio.tar.gz > /dev/null

# 4. Test restore on a test environment
POSTGRES_DB=qubeless_test \
MINIO_BUCKET_SOURCES=sources-test \
MINIO_BUCKET_ARTIFACTS=artifacts-test \
./scripts/restore.sh $BACKUP_PATH
```

### Verify integrity after restore

```bash
# PostgreSQL: verify number of tables
export PGPASSWORD=postgres
psql -h localhost -U postgres -d qubeless -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"

# MinIO: verify number of files
mc ls --recursive qubeless-restore/sources | wc -l
mc ls --recursive qubeless-restore/artifacts | wc -l
```

## Troubleshooting

### Error: "pg_dump: command not found"

```bash
# Install PostgreSQL client
sudo apt-get install postgresql-client   # Ubuntu/Debian
brew install postgresql                  # macOS
```

### Error: "mc: command not found"

```bash
# Install MinIO client
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/
```

### Error: "FATAL: password authentication failed"

```bash
# Verify PostgreSQL credentials
export POSTGRES_PASSWORD=correct_password
./scripts/backup.sh

# Or via .pgpass file
echo "localhost:5432:qubeless:postgres:password" > ~/.pgpass
chmod 600 ~/.pgpass
```

### Error: "mc: Unable to initialize new alias"

```bash
# Verify MinIO credentials
mc alias set test $MINIO_ENDPOINT $MINIO_ACCESS_KEY $MINIO_SECRET_KEY

# Verify connectivity
curl $MINIO_ENDPOINT
```

### Very slow backup

```bash
# Disable compression for large volumes
# Modify backup.sh: remove "gzip"

# Or use faster compression
pigz -c dump.sql > dump.sql.gz  # parallelized
```

### Insufficient disk space

```bash
# Check available space
df -h

# Clean up old backups
find ./backups -type d -mtime +30 -exec rm -rf {} +

# Use a backup directory on a volume with more space
BACKUP_DIR=/mnt/large-volume/backups ./scripts/backup.sh
```

## Security

### Protect backups

```bash
# Encrypt a backup
tar -czf - ./backups/20250126_143022 | \
  openssl enc -aes-256-cbc -salt -out backup.tar.gz.enc

# Decrypt
openssl enc -aes-256-cbc -d -in backup.tar.gz.enc | tar xzf -
```

### Permissions

```bash
# Restrict access to backups
chmod 700 ./backups
chmod 600 ./backups/*/postgres_*.sql.gz
chmod 600 ./backups/*/minio.tar.gz
```

### Sensitive Environment Variables

```bash
# Never commit passwords to Git
# Use a .env file (not versioned)
cat > .env.backup <<EOF
POSTGRES_PASSWORD=secret123
MINIO_SECRET_KEY=secretkey
EOF

# Source before backup
source .env.backup
./scripts/backup.sh
```

## Docker Integration

### Backup from Docker Compose

```bash
# Create a wrapper script
cat > docker-backup.sh <<'EOF'
#!/bin/bash
docker-compose -f docker-compose.dev.yml exec -T postgres pg_dump -U postgres qubeless | gzip > backup.sql.gz
docker run --rm -v minio_data:/data -v $(pwd):/backup alpine tar czf /backup/minio.tar.gz -C /data .
EOF

chmod +x docker-backup.sh
./docker-backup.sh
```

### Restore to Docker Compose

```bash
# Restore PostgreSQL
gunzip < backup.sql.gz | docker-compose -f docker-compose.dev.yml exec -T postgres psql -U postgres qubeless

# Restore MinIO
docker run --rm -v minio_data:/data -v $(pwd):/backup alpine tar xzf /backup/minio.tar.gz -C /data
```

## References

- [PostgreSQL Backup](https://www.postgresql.org/docs/current/backup.html)
- [MinIO Client](https://min.io/docs/minio/linux/reference/minio-mc.html)
- [Backup Best Practices](https://www.backblaze.com/blog/the-3-2-1-backup-strategy/)
