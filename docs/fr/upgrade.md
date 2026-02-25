# Guide de Mise à Jour Qubeless

Ce document décrit la procédure complète et sécurisée pour mettre à jour l'application Qubeless, incluant les migrations de base de données et les déploiements applicatifs.

## Table des Matières

- [Prérequis](#prérequis)
- [Vue d'Ensemble du Processus](#vue-densemble-du-processus)
- [Procédure de Mise à Jour](#procédure-de-mise-à-jour)
- [Stratégie de Rollback](#stratégie-de-rollback)
- [Scénarios Courants](#scénarios-courants)
- [Dépannage](#dépannage)
- [Checklist de Mise à Jour](#checklist-de-mise-à-jour)

---

## Prérequis

### Avant Toute Mise à Jour

#### 1. Outils Requis

```bash
# PostgreSQL client pour les backups/restore
psql --version

# MinIO client pour les backups de fichiers
mc --version

# Node.js et pnpm pour les migrations Prisma
node --version
pnpm --version

# Git pour la gestion des versions
git --version
```

**Installation des outils manquants:**

```bash
# Ubuntu/Debian
sudo apt-get install postgresql-client

# macOS
brew install postgresql minio-mc

# MinIO client (toutes plateformes)
# Voir: https://min.io/docs/minio/linux/reference/minio-mc.html

# Node.js et pnpm
# Voir: https://nodejs.org/ et https://pnpm.io/
```

#### 2. Backup Obligatoire

**IMPORTANT:** Ne jamais effectuer de mise à jour sans backup récent.

```bash
# Exécuter un backup complet
./scripts/backup.sh

# Vérifier que le backup est créé
ls -lh backups/
```

Le script de migration vérifie automatiquement qu'un backup de moins de 24h existe.

#### 3. Accès et Permissions

- Accès SSH/console au serveur
- Permissions sudo si nécessaire
- Accès à la base de données PostgreSQL
- Accès au stockage MinIO
- Variables d'environnement configurées

#### 4. Fenêtre de Maintenance

- Planifier une fenêtre de maintenance
- Notifier les utilisateurs si applicable
- Préparer un plan de communication
- Avoir du temps pour un rollback potentiel (2x temps estimé)

---

## Vue d'Ensemble du Processus

### Architecture de Mise à Jour

```
┌─────────────────────────────────────────────────────────────┐
│                    PROCESSUS DE MISE À JOUR                 │
└─────────────────────────────────────────────────────────────┘

1. PRÉPARATION
   ├─ Vérification des prérequis
   ├─ Backup complet (PostgreSQL + MinIO)
   ├─ Vérification de l'espace disque
   └─ Récupération de la nouvelle version

2. ARRÊT DES SERVICES
   ├─ Arrêt de l'application (web, api, worker)
   ├─ Vérification que tous les processus sont arrêtés
   └─ Mode maintenance activé (optionnel)

3. MIGRATION DE LA BASE DE DONNÉES
   ├─ Vérification de la connexion DB
   ├─ Vérification de l'état des migrations
   ├─ Application des migrations (prisma migrate deploy)
   └─ Vérification post-migration

4. MISE À JOUR DU CODE
   ├─ Pull/déploiement du nouveau code
   ├─ Installation des dépendances (pnpm install)
   ├─ Build des applications (pnpm build)
   └─ Mise à jour des configurations si nécessaire

5. REDÉMARRAGE DES SERVICES
   ├─ Démarrage de l'API
   ├─ Démarrage du Worker
   ├─ Démarrage du Web
   └─ Vérification des health checks

6. VÉRIFICATION
   ├─ Tests de santé (health checks)
   ├─ Tests fonctionnels critiques
   ├─ Vérification des logs
   └─ Monitoring des métriques

7. FINALISATION
   ├─ Documentation des changements
   ├─ Notification de fin de maintenance
   └─ Nettoyage des anciens backups (optionnel)
```

### Ordre Critique des Opérations

**⚠️ IMPORTANT: Respecter scrupuleusement cet ordre**

1. **BACKUP FIRST** - Toujours faire un backup avant toute autre opération
2. **STOP SERVICES** - Arrêter tous les services avant la migration DB
3. **MIGRATE DB** - Appliquer les migrations avant de déployer le nouveau code
4. **UPDATE CODE** - Déployer le nouveau code après les migrations DB
5. **START SERVICES** - Redémarrer dans l'ordre: API → Worker → Web
6. **VERIFY** - Tester avant de considérer la mise à jour terminée

---

## Procédure de Mise à Jour

### Étape 1: Préparation

#### 1.1 Vérifier les Prérequis

```bash
# Vérifier l'espace disque disponible
df -h

# Minimum recommandé:
# - 5 GB pour les backups
# - 2 GB pour les builds
# - 1 GB pour les logs temporaires

# Vérifier la version actuelle
cd /path/to/qubeless
git branch
git log -1
```

#### 1.2 Exécuter le Backup

```bash
# Backup complet
./scripts/backup.sh

# Vérifier le backup
BACKUP_DIR=$(ls -td backups/202* | head -1)
echo "Backup créé: $BACKUP_DIR"
ls -lh "$BACKUP_DIR"

# Vérifier l'intégrité du dump PostgreSQL
gunzip -t "$BACKUP_DIR"/postgres_*.sql.gz
echo "Backup PostgreSQL: OK"

# Vérifier l'archive MinIO
tar -tzf "$BACKUP_DIR"/minio.tar.gz > /dev/null
echo "Backup MinIO: OK"
```

#### 1.3 Récupérer la Nouvelle Version

```bash
# Récupérer les dernières modifications
git fetch origin

# Vérifier la version cible
git log origin/main --oneline -10

# Vérifier les migrations à venir
git diff HEAD origin/main -- apps/api/prisma/migrations/
```

### Étape 2: Arrêt des Services

#### 2.1 Mode Maintenance (Optionnel)

```bash
# Si vous utilisez un reverse proxy (nginx, traefik, etc.)
# Activer une page de maintenance

# Exemple avec nginx
sudo cp /etc/nginx/maintenance.conf /etc/nginx/sites-enabled/qubeless
sudo nginx -s reload
```

#### 2.2 Arrêt des Services

```bash
# Avec Docker Compose
docker-compose -f docker-compose.dev.yml stop

# Vérifier que tous les conteneurs sont arrêtés
docker-compose -f docker-compose.dev.yml ps

# Ou avec systemd
sudo systemctl stop qubeless-web
sudo systemctl stop qubeless-api
sudo systemctl stop qubeless-worker

# Vérifier l'arrêt
sudo systemctl status qubeless-*
```

#### 2.3 Vérification

```bash
# Vérifier qu'aucun processus Node n'est en cours
ps aux | grep node

# Vérifier qu'aucune connexion DB n'est active (sauf la vôtre)
PGPASSWORD=postgres psql -h localhost -U postgres -d qubeless -c "SELECT count(*) FROM pg_stat_activity WHERE datname='qubeless';"
```

### Étape 3: Migration de la Base de Données

#### 3.1 Vérifier l'État Actuel

```bash
# Vérifier la connexion
PGPASSWORD=postgres psql -h localhost -U postgres -d qubeless -c "SELECT version();"

# Vérifier l'état des migrations
npx prisma migrate status --schema=apps/api/prisma/schema.prisma
```

#### 3.2 Exécuter les Migrations

```bash
# Option 1: Mode interactif (recommandé en production)
./scripts/migrate.sh

# Le script va:
# 1. Vérifier les dépendances
# 2. Vérifier la connexion DB
# 3. Vérifier qu'un backup récent existe
# 4. Afficher les migrations à appliquer
# 5. Demander confirmation
# 6. Appliquer les migrations
# 7. Vérifier le résultat

# Option 2: Mode automatique (CI/CD)
FORCE_MODE=true SKIP_BACKUP_CHECK=true ./scripts/migrate.sh

# Option 3: Simulation (dry-run)
DRY_RUN=true ./scripts/migrate.sh
```

#### 3.3 Vérification Post-Migration

```bash
# Vérifier que toutes les migrations sont appliquées
npx prisma migrate status --schema=apps/api/prisma/schema.prisma

# Devrait afficher: "Database schema is up to date!"

# Vérifier quelques tables critiques
PGPASSWORD=postgres psql -h localhost -U postgres -d qubeless -c "\dt"

# Vérifier les données (exemples)
PGPASSWORD=postgres psql -h localhost -U postgres -d qubeless -c "SELECT count(*) FROM users;"
PGPASSWORD=postgres psql -h localhost -U postgres -d qubeless -c "SELECT count(*) FROM projects;"
```

### Étape 4: Mise à Jour du Code

#### 4.1 Déployer la Nouvelle Version

```bash
# Pull de la nouvelle version
git pull origin main

# Ou checkout d'un tag spécifique
git checkout v1.2.0

# Vérifier la version
git log -1
```

#### 4.2 Installer les Dépendances

```bash
# Installer/mettre à jour les dépendances
pnpm install

# Nettoyer le cache si nécessaire
pnpm store prune
```

#### 4.3 Build des Applications

```bash
# Build complet
pnpm build

# Ou par package
pnpm --filter @qubeless/shared build
pnpm --filter @qubeless/api build
pnpm --filter @qubeless/worker build
pnpm --filter @qubeless/web build

# Vérifier que les builds sont créés
ls -lh apps/api/dist/
ls -lh apps/worker/dist/
ls -lh apps/web/dist/
```

#### 4.4 Mettre à Jour les Configurations

```bash
# Vérifier si de nouvelles variables d'environnement sont nécessaires
git diff HEAD~1 docs/fr/deploy.md

# Mettre à jour .env.production si nécessaire
nano .env.production

# Vérifier la configuration Prisma
npx prisma generate --schema=apps/api/prisma/schema.prisma
```

### Étape 5: Redémarrage des Services

#### 5.1 Démarrage Séquentiel

```bash
# Avec Docker Compose
docker-compose -f docker-compose.dev.yml up -d

# Ou avec systemd (dans l'ordre)
sudo systemctl start qubeless-api
sleep 5  # Attendre que l'API soit prête

sudo systemctl start qubeless-worker
sleep 5

sudo systemctl start qubeless-web
```

#### 5.2 Vérification des Logs

```bash
# Docker Compose
docker-compose -f docker-compose.dev.yml logs -f --tail=100

# Ou systemd
sudo journalctl -u qubeless-api -f
sudo journalctl -u qubeless-worker -f
sudo journalctl -u qubeless-web -f

# Chercher les erreurs
docker-compose -f docker-compose.dev.yml logs | grep -i error
docker-compose -f docker-compose.dev.yml logs | grep -i exception
```

### Étape 6: Vérification

#### 6.1 Health Checks

```bash
# API Health Check
curl http://localhost:3001/health
# Attendu: {"status":"ok"}

# Worker Health Check
curl http://localhost:3001/health
# Attendu: {"status":"ok"}

# Web (vérifier que la page charge)
curl -I http://localhost:4000
# Attendu: HTTP/1.1 200 OK
```

#### 6.2 Tests Fonctionnels

```bash
# Tester l'authentification
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Tester la création d'un projet (avec token)
curl -X POST http://localhost:3001/api/projects \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Project"}'

# Tester le worker (vérifier qu'il traite les jobs)
docker-compose -f docker-compose.dev.yml logs worker | grep "Processing job"
```

#### 6.3 Vérification de la Base de Données

```bash
# Vérifier les connexions actives
PGPASSWORD=postgres psql -h localhost -U postgres -d qubeless -c "SELECT count(*) FROM pg_stat_activity WHERE datname='qubeless';"

# Vérifier qu'il n'y a pas d'erreurs récentes dans les logs
docker-compose -f docker-compose.dev.yml logs postgres | grep -i error | tail -20
```

#### 6.4 Monitoring

```bash
# Métriques Prometheus (si configuré)
curl http://localhost:9090/metrics

# Vérifier les métriques clés
curl http://localhost:9090/metrics | grep qubeless_http_requests_total
curl http://localhost:9090/metrics | grep qubeless_jobs_processed_total
```

### Étape 7: Finalisation

#### 7.1 Désactiver le Mode Maintenance

```bash
# Nginx
sudo rm /etc/nginx/sites-enabled/maintenance.conf
sudo nginx -s reload
```

#### 7.2 Documentation

```bash
# Documenter la mise à jour
cat >> CHANGELOG.md <<EOF

## $(date +%Y-%m-%d) - v1.2.0

### Mise à Jour
- Migrations appliquées: [liste des migrations]
- Nouvelles fonctionnalités: [description]
- Corrections de bugs: [liste]

### Opérations
- Backup: backups/$(ls -t backups/ | head -1)
- Durée de maintenance: [durée]
- Statut: ✅ Succès

EOF
```

#### 7.3 Nettoyage (Optionnel)

```bash
# Nettoyer les anciens backups (garder les 7 derniers)
cd backups/
ls -t | tail -n +8 | xargs -r rm -rf

# Nettoyer les logs Docker
docker system prune -f
```

---

## Stratégie de Rollback

### Principes du Rollback

**⚠️ IMPORTANT:**

- Prisma ne supporte **PAS** le rollback automatique des migrations
- Le rollback est un processus **best-effort** (meilleur effort)
- La restauration complète depuis backup est la méthode la plus sûre
- Tester le processus de rollback en pré-production

### Option 1: Restauration Complète (Recommandé)

**Quand l'utiliser:**

- Migration DB a échoué
- Corruption de données détectée
- Comportement inattendu après migration
- En cas de doute

**Procédure:**

```bash
# 1. Arrêter tous les services
docker-compose -f docker-compose.dev.yml stop

# 2. Identifier le backup à restaurer
ls -lth backups/
BACKUP_DIR="backups/20231215_143022"  # Remplacer par votre backup

# 3. Restaurer depuis le backup
./scripts/restore.sh "$BACKUP_DIR"

# Le script va:
# - Vérifier que le backup existe
# - Restaurer PostgreSQL (DROP + RESTORE)
# - Restaurer MinIO
# - Vérifier l'intégrité

# 4. Revenir au code précédent
git reset --hard HEAD~1  # Ou le commit précédent

# 5. Rebuild
pnpm install
pnpm build

# 6. Redémarrer les services
docker-compose -f docker-compose.dev.yml up -d

# 7. Vérifier
./scripts/migrate.sh -d  # Dry-run pour vérifier l'état
```

### Option 2: Migration Inverse Manuelle

**Quand l'utiliser:**

- Migration simple et réversible
- Pas de perte de données acceptable
- Besoin de garder les données créées depuis la migration

**Procédure:**

```bash
# 1. Identifier la migration à annuler
npx prisma migrate status --schema=apps/api/prisma/schema.prisma

# 2. Créer une migration inverse
# Exemple: si la migration a ajouté une colonne
# Créer manuellement un fichier de migration SQL

cat > apps/api/prisma/migrations/rollback_add_column/migration.sql <<EOF
-- Rollback: Remove the column added in previous migration
ALTER TABLE users DROP COLUMN IF EXISTS new_column;
EOF

# 3. Appliquer la migration inverse
npx prisma migrate resolve --applied rollback_add_column --schema=apps/api/prisma/schema.prisma

# 4. Exécuter le SQL manuellement
PGPASSWORD=postgres psql -h localhost -U postgres -d qubeless \
  -f apps/api/prisma/migrations/rollback_add_column/migration.sql

# 5. Vérifier
npx prisma migrate status --schema=apps/api/prisma/schema.prisma
```

### Option 3: Reset Complet (DERNIER RECOURS)

**⚠️ DANGER: PERTE TOTALE DES DONNÉES**

```bash
# NE JAMAIS UTILISER EN PRODUCTION SANS BACKUP

# Reset complet de la base de données
npx prisma migrate reset --schema=apps/api/prisma/schema.prisma

# Restaurer les données depuis le backup
./scripts/restore.sh "$BACKUP_DIR"
```

### Matrice de Décision Rollback

| Situation                         | Action Recommandée           | Perte de Données |
| --------------------------------- | ---------------------------- | ---------------- |
| Migration échouée                 | Restauration complète        | Non              |
| Données corrompues                | Restauration complète        | Non              |
| Bug applicatif (DB OK)            | Rollback code uniquement     | Non              |
| Migration OK mais bug fonctionnel | Migration inverse + fix code | Dépend           |
| Test/développement                | Reset + restore              | N/A              |

---

## Scénarios Courants

### Scénario 1: Mise à Jour Mineure (Patch)

**Exemple: v1.2.0 → v1.2.1 (bug fixes, pas de migration DB)**

```bash
# 1. Backup par précaution
./scripts/backup.sh

# 2. Arrêter les services
docker-compose -f docker-compose.dev.yml stop

# 3. Pull de la nouvelle version
git pull origin main

# 4. Rebuild uniquement (pas de pnpm install si deps inchangées)
pnpm build

# 5. Redémarrer
docker-compose -f docker-compose.dev.yml up -d

# 6. Vérifier
curl http://localhost:3001/health
```

**Durée estimée:** 5-10 minutes

### Scénario 2: Mise à Jour Majeure avec Migrations

**Exemple: v1.2.0 → v2.0.0 (nouvelles fonctionnalités, migrations DB)**

```bash
# 1. Backup (obligatoire)
./scripts/backup.sh

# 2. Arrêter tous les services
docker-compose -f docker-compose.dev.yml stop

# 3. Vérifier les migrations à venir
git fetch origin
git diff HEAD origin/main -- apps/api/prisma/migrations/

# 4. Appliquer les migrations
./scripts/migrate.sh

# 5. Pull de la nouvelle version
git pull origin main

# 6. Installer les nouvelles dépendances
pnpm install

# 7. Rebuild complet
pnpm build

# 8. Redémarrer
docker-compose -f docker-compose.dev.yml up -d

# 9. Tests complets
pnpm test:e2e

# 10. Vérifier les métriques
curl http://localhost:9090/metrics
```

**Durée estimée:** 20-30 minutes

### Scénario 3: Mise à Jour en Production (Zero Downtime)

**Stratégie Blue-Green Deployment**

```bash
# 1. Préparer l'environnement Green (clone)
# Sur un nouveau serveur ou conteneur

# 2. Déployer la nouvelle version sur Green
git clone <repo> qubeless-green
cd qubeless-green
git checkout v2.0.0

# 3. Configurer Green pour utiliser la même DB
cp ../qubeless-blue/.env .env
# Ajuster les ports pour éviter les conflits

# 4. Backup de la DB
./scripts/backup.sh

# 5. Appliquer les migrations (DB partagée)
./scripts/migrate.sh

# 6. Build et démarrer Green
pnpm install
pnpm build
docker-compose -f docker-compose.dev.yml up -d

# 7. Tester Green
curl http://localhost:3010/health

# 8. Basculer le trafic (load balancer / nginx)
# Blue (old) → Green (new)

# 9. Monitorer Green

# 10. Arrêter Blue si tout va bien
cd ../qubeless-blue
docker-compose -f docker-compose.dev.yml stop
```

**Durée estimée:** 30-45 minutes + monitoring

### Scénario 4: Rollback d'Urgence

```bash
# 1. Arrêter immédiatement les services
docker-compose -f docker-compose.dev.yml stop

# 2. Identifier le dernier backup
BACKUP=$(ls -td backups/202* | head -1)
echo "Restoring from: $BACKUP"

# 3. Restaurer
./scripts/restore.sh "$BACKUP"

# 4. Revenir au code précédent
git reset --hard <previous-commit>

# 5. Rebuild
pnpm build

# 6. Redémarrer
docker-compose -f docker-compose.dev.yml up -d

# 7. Vérifier
curl http://localhost:3001/health

# 8. Analyser les logs pour comprendre le problème
docker-compose -f docker-compose.dev.yml logs > incident-$(date +%Y%m%d_%H%M%S).log
```

**Durée estimée:** 10-15 minutes

---

## Dépannage

### Problème: Migration Échoue

**Symptômes:**

```
Error: Migration failed to apply
```

**Solutions:**

```bash
# 1. Vérifier les logs détaillés
npx prisma migrate status --schema=apps/api/prisma/schema.prisma

# 2. Vérifier la connexion DB
PGPASSWORD=postgres psql -h localhost -U postgres -d qubeless -c "SELECT 1;"

# 3. Vérifier les migrations partiellement appliquées
PGPASSWORD=postgres psql -h localhost -U postgres -d qubeless -c "SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;"

# 4. Marquer la migration comme failed et réessayer
npx prisma migrate resolve --rolled-back <migration-name> --schema=apps/api/prisma/schema.prisma
./scripts/migrate.sh

# 5. Si problème persiste: rollback complet
./scripts/restore.sh <backup>
```

### Problème: Services Ne Démarrent Pas

**Symptômes:**

```
Container exits immediately
Health check fails
```

**Solutions:**

```bash
# 1. Vérifier les logs
docker-compose -f docker-compose.dev.yml logs api
docker-compose -f docker-compose.dev.yml logs worker

# 2. Vérifier les variables d'environnement
docker-compose -f docker-compose.dev.yml config

# 3. Vérifier la connexion DB depuis le conteneur
docker-compose -f docker-compose.dev.yml exec api sh
npx prisma db pull --schema=/app/prisma/schema.prisma

# 4. Vérifier les ports
netstat -tulpn | grep :3001

# 5. Rebuilder les images si nécessaire
docker-compose -f docker-compose.dev.yml build --no-cache
docker-compose -f docker-compose.dev.yml up -d
```

### Problème: Backup Trop Ancien

**Symptômes:**

```
[WARNING] Le backup a plus de 24 heures
```

**Solutions:**

```bash
# 1. Créer un nouveau backup
./scripts/backup.sh

# 2. Ou forcer la migration (risqué)
FORCE_MODE=true ./scripts/migrate.sh

# 3. Ou ignorer la vérification (très risqué)
SKIP_BACKUP_CHECK=true ./scripts/migrate.sh
```

### Problème: Espace Disque Insuffisant

**Symptômes:**

```
No space left on device
```

**Solutions:**

```bash
# 1. Vérifier l'espace
df -h

# 2. Nettoyer les anciens backups
cd backups/
ls -t | tail -n +5 | xargs -r rm -rf

# 3. Nettoyer Docker
docker system prune -a -f --volumes

# 4. Nettoyer les logs
sudo journalctl --vacuum-time=7d

# 5. Nettoyer node_modules
find . -name "node_modules" -type d -prune -exec rm -rf '{}' +
pnpm install
```

### Problème: Migrations en Conflit

**Symptômes:**

```
Migration conflict detected
```

**Solutions:**

```bash
# 1. Vérifier l'état
npx prisma migrate status --schema=apps/api/prisma/schema.prisma

# 2. Résoudre manuellement
# Identifier les migrations en conflit
ls -la apps/api/prisma/migrations/

# 3. Marquer comme résolues
npx prisma migrate resolve --applied <migration-name> --schema=apps/api/prisma/schema.prisma

# 4. Si conflit Git
git fetch origin
git merge --strategy-option theirs origin/main
npx prisma migrate dev --name merge_migrations
```

---

## Checklist de Mise à Jour

### Avant la Mise à Jour

- [ ] Lire les notes de version (changelog)
- [ ] Identifier les migrations à appliquer
- [ ] Vérifier l'espace disque disponible (≥ 10 GB)
- [ ] Vérifier que tous les outils sont installés
- [ ] Planifier une fenêtre de maintenance
- [ ] Notifier les utilisateurs (si applicable)
- [ ] Préparer un plan de rollback
- [ ] Tester la procédure en pré-production

### Pendant la Mise à Jour

- [ ] Exécuter le backup complet (`./scripts/backup.sh`)
- [ ] Vérifier l'intégrité du backup
- [ ] Arrêter tous les services
- [ ] Vérifier que tous les processus sont arrêtés
- [ ] Appliquer les migrations DB (`./scripts/migrate.sh`)
- [ ] Vérifier le résultat des migrations
- [ ] Déployer le nouveau code
- [ ] Installer les dépendances (`pnpm install`)
- [ ] Builder les applications (`pnpm build`)
- [ ] Vérifier les builds
- [ ] Mettre à jour les configurations si nécessaire
- [ ] Redémarrer les services dans l'ordre
- [ ] Vérifier les logs au démarrage

### Après la Mise à Jour

- [ ] Exécuter les health checks
- [ ] Tester les fonctionnalités critiques
- [ ] Vérifier la base de données
- [ ] Consulter les métriques
- [ ] Monitorer les logs (15 minutes minimum)
- [ ] Tester un workflow complet utilisateur
- [ ] Désactiver le mode maintenance
- [ ] Notifier la fin de la maintenance
- [ ] Documenter la mise à jour
- [ ] Archiver le backup
- [ ] Planifier un monitoring renforcé (24h)

### En Cas de Problème

- [ ] Conserver les logs d'erreur
- [ ] Évaluer la gravité
- [ ] Décider: fix forward ou rollback
- [ ] Si rollback: exécuter `./scripts/restore.sh`
- [ ] Documenter l'incident
- [ ] Analyser la cause racine
- [ ] Planifier une nouvelle tentative

---

## Exemples de Scripts d'Automatisation

### Script de Mise à Jour Complète

```bash
#!/usr/bin/env bash
# update.sh - Script complet de mise à jour

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

### Script de Pre-Update Checks

```bash
#!/usr/bin/env bash
# pre-update-check.sh - Vérifications avant mise à jour

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
