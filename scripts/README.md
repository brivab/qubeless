# Scripts Qubeless

Ce répertoire contient les scripts utilitaires pour Qubeless.

## Scripts Disponibles

### 🔧 Analyzers

#### [build-analyzers.sh](build-analyzers.sh)
Construit toutes les images Docker des analyseurs.

```bash
# Construction normale (utilise le cache)
./scripts/build-analyzers.sh

# Construction complète sans cache
./scripts/build-analyzers.sh --no-cache

# Avec registre personnalisé
DOCKER_REGISTRY=myregistry ./scripts/build-analyzers.sh
```

**Fonctionnalités:**
- Détecte automatiquement tous les analyseurs dans `analyzers/`
- Construit chaque image avec le tag `qubeless/analyzer-<nom>:latest`
- Affiche un résumé avec succès/échecs
- Affiche la liste des images construites

#### [build-analyzer.sh](build-analyzer.sh)
Construit l'image Docker d'un seul analyseur.

```bash
# Construction d'un analyseur spécifique
./scripts/build-analyzer.sh checkstyle

# Sans cache
./scripts/build-analyzer.sh pmd --no-cache
```

**Analyseurs disponibles:** bandit, checkstyle, eslint, mypy, pmd, pylint, semgrep, spotbugs

### 🚀 Deployment

#### [validate-prod-config.sh](validate-prod-config.sh)
Valide la configuration de production avant le déploiement.

```bash
./scripts/validate-prod-config.sh
```

**Fonctionnalités:**
- Vérifie l'existence de `.env.production`
- Valide toutes les variables obligatoires
- Détecte les valeurs par défaut/test qui doivent être changées
- Valide la syntaxe Docker Compose
- Vérifie la force du JWT_SECRET (min 32 caractères)
- Vérifie l'existence des répertoires de données
- Fournit des recommandations pour la sécurité

**Documentation:** [docs/en/deploy.md](../docs/en/deploy.md)

### 🔄 Backup/Restore

#### [backup.sh](backup.sh)
Sauvegarde PostgreSQL et MinIO.

```bash
./scripts/backup.sh
```

**Fonctionnalités:**
- Backup PostgreSQL avec pg_dump
- Backup MinIO avec mc mirror
- Compression automatique (gzip, tar.gz)
- Vérification des dépendances
- Logs colorés
- Configuration via env vars

**Documentation:** [docs/en/backup-restore.md](../docs/en/backup-restore.md)

#### [restore.sh](restore.sh)
Restaure PostgreSQL et MinIO depuis un backup.

```bash
./scripts/restore.sh ./backups/20250126_120000
```

**Fonctionnalités:**
- Restore PostgreSQL depuis dump
- Restore MinIO depuis archive
- Confirmation obligatoire
- Restore sélectif
- Support migration

**Documentation:** [docs/en/backup-restore.md](../docs/en/backup-restore.md)

#### [migrate.sh](migrate.sh)
Applique les migrations Prisma de manière sécurisée.

```bash
./scripts/migrate.sh
```

**Fonctionnalités:**
- Exécute `prisma migrate deploy`
- Vérification des dépendances (psql, npx)
- Vérification connexion DB
- Vérification backup récent (<24h)
- Mode dry-run pour simulation
- Mode forcé pour CI/CD
- Informations de rollback

**Options:**
```bash
# Mode interactif (recommandé)
./scripts/migrate.sh

# Mode automatique (CI/CD)
FORCE_MODE=true SKIP_BACKUP_CHECK=true ./scripts/migrate.sh

# Simulation
DRY_RUN=true ./scripts/migrate.sh

# Aide
./scripts/migrate.sh --help
```

**Documentation:** [docs/en/upgrade.md](../docs/en/upgrade.md)

### 🧪 Tests

#### [run-all-tests.js](run-all-tests.js)
Lance tous les tests du monorepo (unit, integration, E2E).

```bash
pnpm test
# ou
node scripts/run-all-tests.js

# Options
pnpm test -- --quick
pnpm test -- --unit
pnpm test -- --skip-e2e
```

**Fonctionnalités:**
- Exécution unit/integration/E2E
- Options flexibles (--quick, --skip-*, --only)
- Sortie colorée professionnelle
- Statistiques détaillées
- Exit codes pour CI/CD

**Documentation:** [docs/en/testing.md](../docs/en/testing.md)

#### [test-scripts.js](test-scripts.js)
Teste et valide les scripts utilitaires.

```bash
pnpm test:scripts
# ou
node scripts/test-scripts.js
```

**Tests effectués:**
- Existence et permissions des scripts
- Détection des dépendances
- Variables d'environnement
- Documentation
- Infrastructure de tests

**Résultat:** 27/27 tests passent ✅

#### [test-migrate.js](test-migrate.js)
Teste et valide le script de migration.

```bash
node scripts/test-migrate.js
```

**Tests effectués:**
- Existence et permissions du script
- Affichage de l'aide
- Options de ligne de commande
- Détection des dépendances
- Variables d'environnement documentées
- Documentation upgrade.md
- Procédures de rollback

**Résultat:** 10/10 tests passent ✅

## Variables d'Environnement

### Backup/Restore/Migration

```bash
# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=qubeless
DATABASE_URL=postgresql://...  # Utilisé par migrate.sh

# MinIO
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minio
MINIO_SECRET_KEY=minio123
MINIO_BUCKET_SOURCES=sources
MINIO_BUCKET_ARTIFACTS=artifacts

# Backup
BACKUP_DIR=./backups
BACKUP_TIMESTAMP=20250126_120000

# Restore
RESTORE_POSTGRES=true|false
RESTORE_MINIO=true|false
FORCE=true|false

# Migration
PRISMA_SCHEMA=apps/api/prisma/schema.prisma
FORCE_MODE=true|false          # Skip confirmations
SKIP_BACKUP_CHECK=true|false   # Skip backup verification
DRY_RUN=true|false             # Simulate without applying
```

## Exemples d'Utilisation

### Validation Configuration Production

```bash
# Copier et configurer l'environnement
touch .env.production
# Renseigner les variables selon docs/en/deploy.md (section ".env.production Example")
nano .env.production

# Valider la configuration
./scripts/validate-prod-config.sh

# Si validation OK, démarrer les services
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### Backup Complet

```bash
./scripts/backup.sh
```

Crée un backup dans `./backups/YYYYMMDD_HHMMSS/` avec:
- `postgres_qubeless.sql.gz`
- `minio.tar.gz`
- `backup_metadata.txt`

### Backup Personnalisé

```bash
POSTGRES_HOST=db.example.com \
MINIO_ENDPOINT=http://minio:9000 \
BACKUP_DIR=/mnt/backups \
./scripts/backup.sh
```

### Restore Complet

```bash
./scripts/restore.sh ./backups/20250126_120000
```

Affiche un avertissement et demande confirmation avant de restaurer.

### Restore Sélectif

```bash
# PostgreSQL uniquement
RESTORE_MINIO=false ./scripts/restore.sh ./backups/20250126_120000

# MinIO uniquement
RESTORE_POSTGRES=false ./scripts/restore.sh ./backups/20250126_120000
```

### Restore Forcé (Sans Confirmation)

```bash
FORCE=true ./scripts/restore.sh ./backups/20250126_120000
```

### Migration de Base de Données

```bash
# Migration normale (avec confirmations)
./scripts/migrate.sh

# Migration automatique (CI/CD)
FORCE_MODE=true SKIP_BACKUP_CHECK=true ./scripts/migrate.sh

# Simulation
DRY_RUN=true ./scripts/migrate.sh

# Avec variables personnalisées
POSTGRES_HOST=prod-db POSTGRES_DB=qubeless_prod ./scripts/migrate.sh
```

### Tests

```bash
# Tous les tests
pnpm test

# Tests rapides
pnpm test -- --quick

# Tests unitaires uniquement
pnpm test -- --unit

# Skip E2E
pnpm test -- --skip-e2e

# Validation des scripts
pnpm test:scripts
```

## Prérequis

### Pour Backup/Restore

- `pg_dump` et `psql` (PostgreSQL client)
- `mc` (MinIO client)

**Installation:**

```bash
# macOS
brew install postgresql
brew install minio/stable/mc

# Ubuntu/Debian
apt-get install postgresql-client
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/
```

### Pour Tests

- Node.js 20+
- pnpm
- Services en cours d'exécution (pour E2E):
  - PostgreSQL
  - Redis
  - MinIO (optionnel)

## Documentation

- **Deployment**: [docs/en/deploy.md](../docs/en/deploy.md)
- **Tests**: [docs/en/testing.md](../docs/en/testing.md)
- **Backup/Restore**: [docs/en/backup-restore.md](../docs/en/backup-restore.md)
- **Upgrade & Migration**: [docs/en/upgrade.md](../docs/en/upgrade.md)

## Aide

Pour plus d'informations:

```bash
# Backup/Restore
./scripts/backup.sh         # Affiche aide si dépendances manquantes
./scripts/restore.sh        # Affiche usage

# Migration
./scripts/migrate.sh --help # Aide complète

# Tests
pnpm test -- --help         # (si implémenté)
```

## Contribution

Lors de l'ajout de nouveaux scripts:
1. Rendre le script exécutable: `chmod +x scripts/nom.sh`
2. Ajouter documentation dans ce README
3. Ajouter tests dans `test-scripts.js` si applicable
4. Mettre à jour la documentation principale

## Statut

✅ **Tous les scripts sont fonctionnels et testés**

- ✅ validate-prod-config.sh - Fonctionne
- ✅ backup.sh - Fonctionne
- ✅ restore.sh - Fonctionne
- ✅ migrate.sh - Fonctionne (10/10 tests)
- ✅ run-all-tests.js - Fonctionne
- ✅ test-scripts.js - 27/27 tests passent
- ✅ test-migrate.js - 10/10 tests passent
