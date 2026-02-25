# Guide Rapide - Migration Qubeless

Guide de démarrage rapide pour les migrations de base de données Qubeless.

## Installation

### Prérequis

```bash
# Installer PostgreSQL client (si pas déjà fait)
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql-client

# Vérifier
psql --version
```

## Utilisation Rapide

### 1. Avant une Migration - Backup Obligatoire

```bash
# Créer un backup complet
./scripts/backup.sh

# Vérifier le backup
ls -lh backups/
```

### 2. Appliquer les Migrations

```bash
# Mode interactif (recommandé pour la première fois)
./scripts/migrate.sh

# Le script va:
# ✓ Vérifier les dépendances
# ✓ Vérifier la connexion DB
# ✓ Vérifier qu'un backup récent existe (<24h)
# ✓ Afficher les migrations à appliquer
# ✓ Demander confirmation
# ✓ Appliquer les migrations
# ✓ Afficher les infos de rollback
```

### 3. Vérification

```bash
# Vérifier l'état des migrations
npx prisma migrate status --schema=apps/api/prisma/schema.prisma

# Devrait afficher: "Database schema is up to date!"
```

## Modes d'Utilisation

### Mode Développement

```bash
# Avec confirmations
./scripts/migrate.sh
```

### Mode Production

```bash
# 1. TOUJOURS faire un backup d'abord
./scripts/backup.sh

# 2. Simulation (dry-run)
DRY_RUN=true ./scripts/migrate.sh

# 3. Application réelle
./scripts/migrate.sh
```

### Mode CI/CD

```bash
# Automatique sans confirmations
FORCE_MODE=true SKIP_BACKUP_CHECK=true ./scripts/migrate.sh
```

### Simulation

```bash
# Voir ce qui va se passer sans appliquer
DRY_RUN=true ./scripts/migrate.sh
```

## Options Disponibles

```bash
./scripts/migrate.sh [OPTIONS]

Options:
  -h, --help              Afficher l'aide
  -f, --force             Mode forcé (pas de confirmations)
  -s, --skip-backup       Ignorer la vérification du backup
  -d, --dry-run           Simuler sans appliquer

Variables d'environnement:
  FORCE_MODE=true         Mode forcé
  SKIP_BACKUP_CHECK=true  Ignorer vérification backup
  DRY_RUN=true            Simulation
  POSTGRES_HOST=...       Hôte PostgreSQL
  POSTGRES_PORT=...       Port PostgreSQL
  POSTGRES_DB=...         Base de données
```

## En Cas de Problème

### Rollback Complet (Recommandé)

```bash
# 1. Arrêter les services
docker-compose -f docker-compose.dev.yml stop

# 2. Identifier le backup
ls -lht backups/

# 3. Restaurer
./scripts/restore.sh backups/20250126_120000

# 4. Vérifier
npx prisma migrate status --schema=apps/api/prisma/schema.prisma
```

### Migration Échoue

```bash
# 1. Vérifier les logs
npx prisma migrate status --schema=apps/api/prisma/schema.prisma

# 2. Si nécessaire, restaurer le backup
./scripts/restore.sh backups/LATEST

# 3. Analyser le problème
docker-compose -f docker-compose.dev.yml logs postgres
```

### Backup Trop Ancien

```bash
# Si le backup a plus de 24h, créer un nouveau
./scripts/backup.sh

# Puis relancer la migration
./scripts/migrate.sh
```

## Workflow Complet de Mise à Jour

```bash
# 1. Backup
./scripts/backup.sh

# 2. Arrêter les services
docker-compose -f docker-compose.dev.yml stop

# 3. Appliquer les migrations
./scripts/migrate.sh

# 4. Mettre à jour le code
git pull origin main

# 5. Installer les dépendances
pnpm install

# 6. Build
pnpm build

# 7. Redémarrer les services
docker-compose -f docker-compose.dev.yml up -d

# 8. Vérifier
curl http://localhost:3001/health
```

## Exemples Pratiques

### Exemple 1: Première Migration

```bash
# Créer un backup
./scripts/backup.sh
# Output: Backup créé dans backups/20250126_143022/

# Appliquer la migration
./scripts/migrate.sh
# Suivre les instructions à l'écran
# Confirmer avec 'y' quand demandé

# Vérifier
npx prisma migrate status --schema=apps/api/prisma/schema.prisma
# Output: Database schema is up to date!
```

### Exemple 2: Migration en Production

```bash
# 1. Backup
./scripts/backup.sh

# 2. Test en simulation
DRY_RUN=true ./scripts/migrate.sh
# Vérifier la sortie

# 3. Application réelle
./scripts/migrate.sh
# Confirmer

# 4. En cas de problème
./scripts/restore.sh backups/20250126_143022
```

### Exemple 3: Pipeline CI/CD

```bash
#!/bin/bash
set -e

# Backup (optionnel en CI si DB de test)
SKIP_BACKUP_CHECK=true ./scripts/backup.sh || true

# Migration automatique
FORCE_MODE=true SKIP_BACKUP_CHECK=true ./scripts/migrate.sh

# Tests
pnpm test

# Déploiement
./scripts/deploy.sh
```

## Commandes Utiles

```bash
# Vérifier l'état des migrations
npx prisma migrate status --schema=apps/api/prisma/schema.prisma

# Lister les backups disponibles
ls -lht backups/

# Vérifier la connexion DB
PGPASSWORD=postgres psql -h localhost -U postgres -d qubeless -c "SELECT version();"

# Voir les migrations disponibles
ls -la apps/api/prisma/migrations/

# Tester le script
node scripts/test-migrate.js
```

## Checklist Migration

Avant chaque migration:

- [ ] Backup créé et vérifié
- [ ] Services arrêtés (production)
- [ ] Migration testée en dev/staging
- [ ] Fenêtre de maintenance planifiée (si prod)
- [ ] Plan de rollback préparé

Pendant la migration:

- [ ] Lire les messages du script attentivement
- [ ] Vérifier les migrations à appliquer
- [ ] Confirmer uniquement si tout est correct

Après la migration:

- [ ] Vérifier l'état avec `prisma migrate status`
- [ ] Tester les fonctionnalités critiques
- [ ] Vérifier les logs
- [ ] Garder le backup au moins 7 jours

## Aide et Documentation

- **Guide complet**: [docs/upgrade.md](upgrade.md)
- **Backup/Restore**: [docs/backup-restore.md](backup-restore.md)
- **Aide du script**: `./scripts/migrate.sh --help`
- **Scripts disponibles**: [scripts/README.md](../../scripts/README.md)

## Support

En cas de problème:

1. Vérifier [docs/upgrade.md](upgrade.md) section "Dépannage"
2. Consulter les logs: `docker-compose -f docker-compose.dev.yml logs postgres`
3. Vérifier l'état: `npx prisma migrate status`
4. En dernier recours: restaurer le backup

---

**Dernière mise à jour:** 2025-12-26
