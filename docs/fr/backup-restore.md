# Backup et Restore Qubeless

Ce document décrit comment sauvegarder et restaurer l'ensemble du système Qubeless, incluant la base de données PostgreSQL et le stockage MinIO.

## Vue d'ensemble

Les scripts de backup et restore permettent de:
- **Sauvegarder** la base de données PostgreSQL et les fichiers MinIO
- **Restaurer** l'ensemble du système à partir d'un backup
- **Migrer** les données vers un nouvel environnement

## Prérequis

### Installation des outils

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

# Docker (utiliser l'image officielle)
docker pull minio/mc
```

Vérification:
```bash
pg_dump --version
mc --version
```

## Backup

### Utilisation de base

```bash
./scripts/backup.sh
```

Le backup sera créé dans `./backups/YYYYMMDD_HHMMSS/` avec:
- `postgres_qubeless.sql.gz` - Dump compressé de PostgreSQL
- `minio.tar.gz` - Archive des buckets MinIO
- `backup_metadata.txt` - Métadonnées du backup

### Configuration via variables d'environnement

#### PostgreSQL
```bash
export POSTGRES_HOST=localhost      # Hôte PostgreSQL
export POSTGRES_PORT=5432           # Port PostgreSQL
export POSTGRES_USER=postgres       # Utilisateur PostgreSQL
export POSTGRES_PASSWORD=postgres   # Mot de passe PostgreSQL
export POSTGRES_DB=qubeless         # Base de données à sauvegarder
```

#### MinIO
```bash
export MINIO_ENDPOINT=http://localhost:9000  # Endpoint MinIO
export MINIO_ACCESS_KEY=minio                # Clé d'accès MinIO
export MINIO_SECRET_KEY=minio123             # Clé secrète MinIO
export MINIO_BUCKET_SOURCES=sources          # Bucket des sources
export MINIO_BUCKET_ARTIFACTS=artifacts      # Bucket des artefacts
```

#### Répertoire de backup
```bash
export BACKUP_DIR=/path/to/backups     # Répertoire racine des backups
export BACKUP_TIMESTAMP=20250126_120000  # Timestamp personnalisé (optionnel)
```

### Exemples

#### Backup standard (localhost)
```bash
./scripts/backup.sh
```

#### Backup depuis un serveur distant
```bash
POSTGRES_HOST=db.example.com \
POSTGRES_PASSWORD=secret123 \
MINIO_ENDPOINT=http://minio.example.com:9000 \
MINIO_SECRET_KEY=secretkey \
./scripts/backup.sh
```

#### Backup vers un répertoire personnalisé
```bash
BACKUP_DIR=/mnt/backups ./scripts/backup.sh
```

#### Backup depuis Docker Compose
```bash
# Utiliser les variables d'environnement du docker-compose.dev.yml
docker-compose -f docker-compose.dev.yml exec postgres pg_dump -U postgres qubeless | gzip > backup.sql.gz

# Ou via le script (depuis l'hôte)
./scripts/backup.sh
```

### Sortie du script

```
[INFO] === Qubeless Backup Started ===
[INFO] Timestamp: 20250126_143022

[SUCCESS] Toutes les dépendances sont présentes
[SUCCESS] Répertoire de backup créé: ./backups/20250126_143022
[SUCCESS] Client MinIO configuré

[INFO] Sauvegarde de PostgreSQL (qubeless)...
[SUCCESS] PostgreSQL sauvegardé: ./backups/20250126_143022/postgres_qubeless.sql.gz (2.4M)

[INFO] Sauvegarde de MinIO...
[INFO]   - Sauvegarde du bucket: sources
[SUCCESS]    Bucket 'sources' sauvegardé: 145M (42 fichiers)
[INFO]   - Sauvegarde du bucket: artifacts
[SUCCESS]    Bucket 'artifacts' sauvegardé: 89M (128 fichiers)
[INFO] Compression de MinIO...
[SUCCESS] MinIO compressé: ./backups/20250126_143022/minio.tar.gz (198M)

[SUCCESS] Métadonnées créées: ./backups/20250126_143022/backup_metadata.txt

[SUCCESS] === Backup Completed ===
[INFO] Location: ./backups/20250126_143022
[INFO] Taille totale: 200M

[INFO] Fichiers créés:
  - backup_metadata.txt (573)
  - minio.tar.gz (198M)
  - postgres_qubeless.sql.gz (2.4M)
```

## Restore

### Utilisation de base

```bash
./scripts/restore.sh ./backups/20250126_143022
```

### ⚠️ Avertissements importants

- **Les données existantes seront ÉCRASÉES**
- Le script demande une confirmation explicite (taper `yes`)
- Utilisez `FORCE=true` pour automatiser (avec précaution)
- Testez d'abord sur un environnement de dev/test

### Configuration via variables d'environnement

#### Options de restauration
```bash
export RESTORE_POSTGRES=true|false   # Restaurer PostgreSQL (défaut: true)
export RESTORE_MINIO=true|false      # Restaurer MinIO (défaut: true)
export FORCE=true|false              # Forcer sans confirmation (défaut: false)
```

#### Cibles de restauration (mêmes variables que le backup)
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

### Exemples

#### Restauration complète
```bash
./scripts/restore.sh ./backups/20250126_143022
```

#### Restauration PostgreSQL uniquement
```bash
RESTORE_MINIO=false ./scripts/restore.sh ./backups/20250126_143022
```

#### Restauration MinIO uniquement
```bash
RESTORE_POSTGRES=false ./scripts/restore.sh ./backups/20250126_143022
```

#### Restauration vers un autre serveur
```bash
POSTGRES_HOST=prod-db.example.com \
POSTGRES_PASSWORD=prodpassword \
./scripts/restore.sh ./backups/20250126_143022
```

#### Restauration forcée (sans confirmation)
```bash
# ATTENTION: À utiliser uniquement dans des scripts automatisés
FORCE=true ./scripts/restore.sh ./backups/20250126_143022
```

#### Migration vers un nouvel environnement
```bash
# Restaurer depuis un backup de production vers un serveur de staging
POSTGRES_HOST=staging-db.example.com \
POSTGRES_DB=qubeless_staging \
POSTGRES_PASSWORD=stagingpass \
MINIO_ENDPOINT=http://staging-minio.example.com:9000 \
MINIO_SECRET_KEY=stagingsecret \
./scripts/restore.sh ./backups/prod_20250126_143022
```

### Sortie du script

```
[INFO] === Qubeless Restore Started ===
[INFO] Backup path: ./backups/20250126_143022

[SUCCESS] Toutes les dépendances sont présentes
[INFO] Vérification du backup...
[INFO] Métadonnées trouvées:
  Qubeless Backup Metadata
  ========================
  Date: Thu Jan 26 14:30:22 UTC 2025
  Timestamp: 20250126_143022
  ...

[INFO] Contenu du backup:
  - backup_metadata.txt (573)
  - minio.tar.gz (198M)
  - postgres_qubeless.sql.gz (2.4M)

╔════════════════════════════════════════════════════════╗
║              ⚠️  AVERTISSEMENT IMPORTANT ⚠️              ║
╚════════════════════════════════════════════════════════╝

[WARNING] Cette opération va ÉCRASER les données existantes !

[INFO] PostgreSQL sera restauré:
[INFO]   - Base de données: qubeless
[INFO]   - Hôte: localhost:5432
[INFO] MinIO sera restauré:
[INFO]   - Endpoint: http://localhost:9000
[INFO]   - Buckets: sources, artifacts

Êtes-vous sûr de vouloir continuer? Tapez 'yes' pour confirmer: yes

[SUCCESS] Client MinIO configuré

[INFO] Restauration de PostgreSQL...
[INFO] Fichier de dump: postgres_qubeless.sql.gz
[INFO] Décompression et restauration en cours...
[SUCCESS] PostgreSQL restauré avec succès
[INFO] Tables restaurées: 23

[INFO] Restauration de MinIO...
[INFO] Archive MinIO: minio.tar.gz
[INFO] Décompression dans /tmp/tmp.X9K2Qw3dkL...
[INFO]   - Restauration du bucket: sources
[INFO]     Bucket 'sources' créé
[INFO]     Nettoyage du bucket existant...
[SUCCESS]    Bucket 'sources' restauré (42 fichiers)
[INFO]   - Restauration du bucket: artifacts
[SUCCESS]    Bucket 'artifacts' restauré (128 fichiers)
[SUCCESS] MinIO restauré avec succès

[SUCCESS] === Restore Completed ===
[INFO] Vérifiez que votre application fonctionne correctement
```

## Automatisation

### Backup automatique quotidien (cron)

```bash
# Éditer le crontab
crontab -e

# Ajouter une ligne pour un backup quotidien à 2h du matin
0 2 * * * cd /path/to/qubeless && BACKUP_DIR=/mnt/backups ./scripts/backup.sh >> /var/log/qubeless-backup.log 2>&1
```

### Backup avec rotation (conserver les 7 derniers jours)

```bash
#!/bin/bash
# backup-rotate.sh

# Backup
cd /path/to/qubeless
BACKUP_DIR=/mnt/backups ./scripts/backup.sh

# Suppression des backups de plus de 7 jours
find /mnt/backups -type d -mtime +7 -name "202*" -exec rm -rf {} +
```

### Script de backup distant (SSH)

```bash
#!/bin/bash
# remote-backup.sh

# Backup sur le serveur distant
ssh user@server.example.com 'cd /app/qubeless && ./scripts/backup.sh'

# Copier le backup localement
LATEST_BACKUP=$(ssh user@server.example.com 'ls -td /app/qubeless/backups/* | head -1')
scp -r user@server.example.com:$LATEST_BACKUP ./local-backups/
```

## Stratégies de backup

### Backup 3-2-1

La règle 3-2-1 recommande:
- **3** copies de vos données
- Sur **2** types de supports différents
- **1** copie hors site

Exemple d'implémentation:
```bash
#!/bin/bash
# Backup local
./scripts/backup.sh

# Copie sur un NAS (support 2)
rsync -av ./backups/ /mnt/nas/qubeless-backups/

# Copie vers le cloud (hors site)
rclone sync ./backups/ remote:qubeless-backups/
```

### Backup incrémental

Pour des backups plus fréquents et économes en espace:

```bash
# Backup complet hebdomadaire
0 2 * * 0 ./scripts/backup.sh

# Backup incrémental quotidien (PostgreSQL uniquement)
0 2 * * 1-6 RESTORE_MINIO=false ./scripts/backup.sh
```

## Vérification et tests

### Tester un backup

```bash
# 1. Créer un backup
./scripts/backup.sh

# 2. Vérifier le contenu
BACKUP_PATH=$(ls -td ./backups/* | head -1)
cat $BACKUP_PATH/backup_metadata.txt

# 3. Tester la décompression
gunzip -t $BACKUP_PATH/postgres_*.sql.gz
tar -tzf $BACKUP_PATH/minio.tar.gz > /dev/null

# 4. Tester la restauration sur un environnement de test
POSTGRES_DB=qubeless_test \
MINIO_BUCKET_SOURCES=sources-test \
MINIO_BUCKET_ARTIFACTS=artifacts-test \
./scripts/restore.sh $BACKUP_PATH
```

### Vérifier l'intégrité après restauration

```bash
# PostgreSQL: vérifier le nombre de tables
export PGPASSWORD=postgres
psql -h localhost -U postgres -d qubeless -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"

# MinIO: vérifier le nombre de fichiers
mc ls --recursive qubeless-restore/sources | wc -l
mc ls --recursive qubeless-restore/artifacts | wc -l
```

## Dépannage

### Erreur: "pg_dump: command not found"

```bash
# Installer le client PostgreSQL
sudo apt-get install postgresql-client   # Ubuntu/Debian
brew install postgresql                  # macOS
```

### Erreur: "mc: command not found"

```bash
# Installer le client MinIO
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/
```

### Erreur: "FATAL: password authentication failed"

```bash
# Vérifier les credentials PostgreSQL
export POSTGRES_PASSWORD=correct_password
./scripts/backup.sh

# Ou via le fichier .pgpass
echo "localhost:5432:qubeless:postgres:password" > ~/.pgpass
chmod 600 ~/.pgpass
```

### Erreur: "mc: Unable to initialize new alias"

```bash
# Vérifier les credentials MinIO
mc alias set test $MINIO_ENDPOINT $MINIO_ACCESS_KEY $MINIO_SECRET_KEY

# Vérifier la connectivité
curl $MINIO_ENDPOINT
```

### Backup très lent

```bash
# Désactiver la compression pour les gros volumes
# Modifier backup.sh: retirer le "gzip"

# Ou utiliser une compression plus rapide
pigz -c dump.sql > dump.sql.gz  # parallélisé
```

### Espace disque insuffisant

```bash
# Vérifier l'espace disponible
df -h

# Nettoyer les anciens backups
find ./backups -type d -mtime +30 -exec rm -rf {} +

# Utiliser un répertoire de backup sur un volume avec plus d'espace
BACKUP_DIR=/mnt/large-volume/backups ./scripts/backup.sh
```

## Sécurité

### Protection des backups

```bash
# Chiffrer un backup
tar -czf - ./backups/20250126_143022 | \
  openssl enc -aes-256-cbc -salt -out backup.tar.gz.enc

# Déchiffrer
openssl enc -aes-256-cbc -d -in backup.tar.gz.enc | tar xzf -
```

### Permissions

```bash
# Restreindre l'accès aux backups
chmod 700 ./backups
chmod 600 ./backups/*/postgres_*.sql.gz
chmod 600 ./backups/*/minio.tar.gz
```

### Variables d'environnement sensibles

```bash
# Ne jamais commiter les mots de passe dans Git
# Utiliser un fichier .env (non versionné)
cat > .env.backup <<EOF
POSTGRES_PASSWORD=secret123
MINIO_SECRET_KEY=secretkey
EOF

# Sourcer avant le backup
source .env.backup
./scripts/backup.sh
```

## Intégration avec Docker

### Backup depuis Docker Compose

```bash
# Créer un script wrapper
cat > docker-backup.sh <<'EOF'
#!/bin/bash
docker-compose -f docker-compose.dev.yml exec -T postgres pg_dump -U postgres qubeless | gzip > backup.sql.gz
docker run --rm -v minio_data:/data -v $(pwd):/backup alpine tar czf /backup/minio.tar.gz -C /data .
EOF

chmod +x docker-backup.sh
./docker-backup.sh
```

### Restore vers Docker Compose

```bash
# Restaurer PostgreSQL
gunzip < backup.sql.gz | docker-compose -f docker-compose.dev.yml exec -T postgres psql -U postgres qubeless

# Restaurer MinIO
docker run --rm -v minio_data:/data -v $(pwd):/backup alpine tar xzf /backup/minio.tar.gz -C /data
```

## Références

- [PostgreSQL Backup](https://www.postgresql.org/docs/current/backup.html)
- [MinIO Client](https://min.io/docs/minio/linux/reference/minio-mc.html)
- [Backup Best Practices](https://www.backblaze.com/blog/the-3-2-1-backup-strategy/)
