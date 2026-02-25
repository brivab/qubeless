#!/usr/bin/env bash
set -euo pipefail

#######################################
# Qubeless Database Migration Script
# Exécute les migrations Prisma de manière sécurisée
#######################################

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonctions de log
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Variables d'environnement avec valeurs par défaut
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-qubeless}"

# Construction de DATABASE_URL si non définie
if [ -z "${DATABASE_URL:-}" ]; then
    DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
    export DATABASE_URL
fi

# Chemin vers le schéma Prisma
PRISMA_SCHEMA="${PRISMA_SCHEMA:-apps/api/prisma/schema.prisma}"

# Options
FORCE_MODE="${FORCE_MODE:-false}"
SKIP_BACKUP_CHECK="${SKIP_BACKUP_CHECK:-false}"
DRY_RUN="${DRY_RUN:-false}"

# Vérification des dépendances
check_dependencies() {
    log_info "Vérification des dépendances..."

    local missing_deps=()

    if ! command -v psql &> /dev/null; then
        missing_deps+=("psql (postgresql-client)")
    fi

    if ! command -v npx &> /dev/null; then
        missing_deps+=("npx (Node.js)")
    fi

    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Dépendances manquantes: ${missing_deps[*]}"
        log_info "Installation:"
        log_info "  - PostgreSQL client: apt-get install postgresql-client (ou brew install postgresql)"
        log_info "  - Node.js: https://nodejs.org/"
        exit 1
    fi

    # Vérifier que le schéma Prisma existe
    if [ ! -f "$PRISMA_SCHEMA" ]; then
        log_error "Schéma Prisma non trouvé: $PRISMA_SCHEMA"
        exit 1
    fi

    log_success "Toutes les dépendances sont présentes"
}

# Vérification de la connexion à la base de données
check_database_connection() {
    log_info "Vérification de la connexion à la base de données..."

    export PGPASSWORD="$POSTGRES_PASSWORD"

    if psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1;" > /dev/null 2>&1; then
        log_success "Connexion à la base de données établie"
    else
        log_error "Impossible de se connecter à la base de données"
        log_info "Vérifiez vos paramètres de connexion:"
        log_info "  Host: $POSTGRES_HOST:$POSTGRES_PORT"
        log_info "  Database: $POSTGRES_DB"
        log_info "  User: $POSTGRES_USER"
        unset PGPASSWORD
        exit 1
    fi

    unset PGPASSWORD
}

# Vérification de l'état des migrations
check_migration_status() {
    log_info "Vérification de l'état des migrations..."

    # Récupérer le statut des migrations
    if npx prisma migrate status --schema="$PRISMA_SCHEMA" 2>&1 | grep -q "Database schema is up to date"; then
        log_success "Toutes les migrations sont déjà appliquées"

        if [ "$FORCE_MODE" = "false" ]; then
            log_info "Aucune migration à appliquer. Utilisez FORCE_MODE=true pour forcer."
            exit 0
        else
            log_warning "Mode forcé activé, continuation..."
        fi
    elif npx prisma migrate status --schema="$PRISMA_SCHEMA" 2>&1 | grep -q "Following migration"; then
        log_warning "Des migrations sont en attente d'application"
    else
        log_info "Impossible de déterminer l'état des migrations, continuation..."
    fi
}

# Vérification qu'un backup récent existe
check_recent_backup() {
    if [ "$SKIP_BACKUP_CHECK" = "true" ]; then
        log_warning "Vérification du backup ignorée (SKIP_BACKUP_CHECK=true)"
        return 0
    fi

    log_info "Vérification de l'existence d'un backup récent..."

    local backup_dir="./backups"

    if [ ! -d "$backup_dir" ]; then
        log_error "Aucun répertoire de backup trouvé: $backup_dir"
        log_info "Exécutez d'abord un backup avec: ./scripts/backup.sh"
        log_info "Ou ignorez cette vérification avec: SKIP_BACKUP_CHECK=true"
        exit 1
    fi

    # Trouver le backup le plus récent
    local latest_backup=$(find "$backup_dir" -maxdepth 1 -type d -name "202*" | sort -r | head -n 1)

    if [ -z "$latest_backup" ]; then
        log_error "Aucun backup trouvé dans: $backup_dir"
        log_info "Exécutez d'abord un backup avec: ./scripts/backup.sh"
        log_info "Ou ignorez cette vérification avec: SKIP_BACKUP_CHECK=true"
        exit 1
    fi

    # Vérifier l'âge du backup (moins de 24h recommandé)
    local backup_age=$(( ($(date +%s) - $(stat -f %m "$latest_backup" 2>/dev/null || stat -c %Y "$latest_backup")) / 3600 ))

    log_success "Backup trouvé: $(basename "$latest_backup") (${backup_age}h)"

    if [ "$backup_age" -gt 24 ]; then
        log_warning "Le backup a plus de 24 heures (${backup_age}h)"

        if [ "$FORCE_MODE" = "false" ]; then
            read -p "Voulez-vous continuer malgré tout? [y/N] " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_info "Migration annulée. Exécutez d'abord: ./scripts/backup.sh"
                exit 0
            fi
        fi
    fi
}

# Afficher un résumé des migrations à appliquer
show_migration_summary() {
    log_info "Résumé des migrations à appliquer:"
    echo

    npx prisma migrate status --schema="$PRISMA_SCHEMA" || true

    echo
}

# Confirmation de l'utilisateur
confirm_migration() {
    if [ "$FORCE_MODE" = "true" ]; then
        log_warning "Mode forcé activé, pas de confirmation demandée"
        return 0
    fi

    echo
    log_warning "ATTENTION: Les migrations vont être appliquées à la base de données"
    log_info "Base de données: ${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
    echo

    read -p "Voulez-vous continuer? [y/N] " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Migration annulée"
        exit 0
    fi
}

# Exécuter les migrations
run_migrations() {
    if [ "$DRY_RUN" = "true" ]; then
        log_info "Mode DRY_RUN: Les migrations ne seront PAS appliquées"
        return 0
    fi

    log_info "Application des migrations..."
    echo

    if npx prisma migrate deploy --schema="$PRISMA_SCHEMA"; then
        echo
        log_success "Migrations appliquées avec succès"
    else
        echo
        log_error "Échec de l'application des migrations"
        log_warning "Pour restaurer depuis un backup, utilisez: ./scripts/restore.sh"
        exit 1
    fi
}

# Vérification post-migration
verify_migration() {
    log_info "Vérification post-migration..."

    if npx prisma migrate status --schema="$PRISMA_SCHEMA" 2>&1 | grep -q "Database schema is up to date"; then
        log_success "La base de données est à jour"
    else
        log_warning "Le statut des migrations est incertain, vérification manuelle recommandée"
    fi
}

# Afficher les informations de rollback
show_rollback_info() {
    echo
    log_info "=== Informations de Rollback (Best-Effort) ==="
    echo
    log_warning "Prisma ne supporte pas le rollback automatique des migrations"
    log_info "En cas de problème, vous pouvez:"
    echo
    log_info "1. Restaurer depuis le backup:"
    log_info "   ./scripts/restore.sh <backup_timestamp>"
    echo
    log_info "2. Ou créer une migration inverse manuellement:"
    log_info "   - Identifier la dernière migration appliquée"
    log_info "   - Créer une nouvelle migration qui annule les changements"
    log_info "   - npx prisma migrate dev --name rollback_xxx"
    echo
    log_info "3. En dernier recours, reset complet (PERTE DE DONNÉES):"
    log_info "   npx prisma migrate reset --schema=$PRISMA_SCHEMA"
    echo
}

# Afficher l'aide
show_help() {
    cat <<EOF
Usage: ./scripts/migrate.sh [OPTIONS]

Script de migration sécurisé pour Qubeless.
Exécute 'prisma migrate deploy' après vérifications.

OPTIONS:
    -h, --help              Afficher cette aide
    -f, --force             Mode forcé (pas de confirmations)
    -s, --skip-backup       Ignorer la vérification du backup
    -d, --dry-run           Simuler sans appliquer les migrations

VARIABLES D'ENVIRONNEMENT:
    DATABASE_URL            URL de connexion PostgreSQL
    POSTGRES_HOST           Hôte PostgreSQL (défaut: localhost)
    POSTGRES_PORT           Port PostgreSQL (défaut: 5432)
    POSTGRES_USER           Utilisateur PostgreSQL (défaut: postgres)
    POSTGRES_PASSWORD       Mot de passe PostgreSQL (défaut: postgres)
    POSTGRES_DB             Base de données (défaut: qubeless)
    PRISMA_SCHEMA           Chemin vers schema.prisma (défaut: apps/api/prisma/schema.prisma)
    FORCE_MODE              true pour mode forcé (défaut: false)
    SKIP_BACKUP_CHECK       true pour ignorer vérification backup (défaut: false)
    DRY_RUN                 true pour simulation (défaut: false)

EXEMPLES:
    # Migration normale (avec confirmations)
    ./scripts/migrate.sh

    # Migration automatique (CI/CD)
    FORCE_MODE=true SKIP_BACKUP_CHECK=true ./scripts/migrate.sh

    # Simulation
    DRY_RUN=true ./scripts/migrate.sh

    # Avec variables d'environnement personnalisées
    POSTGRES_HOST=prod-db POSTGRES_DB=qubeless_prod ./scripts/migrate.sh

PRÉREQUIS:
    - Exécuter un backup avant: ./scripts/backup.sh
    - Base de données accessible
    - Node.js et Prisma installés

DOCUMENTATION:
    Voir docs/en/upgrade.md pour le guide complet

EOF
}

# Parse des arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -f|--force)
                FORCE_MODE=true
                shift
                ;;
            -s|--skip-backup)
                SKIP_BACKUP_CHECK=true
                shift
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            *)
                log_error "Option inconnue: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Main
main() {
    parse_arguments "$@"

    log_info "=== Qubeless Database Migration ==="
    log_info "Date: $(date)"
    echo

    # Vérifications préalables
    check_dependencies
    check_database_connection
    check_migration_status
    check_recent_backup

    echo

    # Afficher le résumé
    show_migration_summary

    # Confirmation
    confirm_migration

    echo

    # Exécution
    run_migrations

    # Vérification
    verify_migration

    # Informations de rollback
    show_rollback_info

    log_success "=== Migration Completed ==="
}

# Exécution
main "$@"
