#!/usr/bin/env bash
set -euo pipefail

#######################################
# Qubeless Restore Script
# Restauration PostgreSQL et MinIO
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
BACKUP_PATH="${1:-}"

# PostgreSQL
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-qubeless}"

# MinIO
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://localhost:9000}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-minio}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-minio123}"
MINIO_BUCKET_SOURCES="${MINIO_BUCKET_SOURCES:-sources}"
MINIO_BUCKET_ARTIFACTS="${MINIO_BUCKET_ARTIFACTS:-artifacts}"

# Options de restauration
RESTORE_POSTGRES="${RESTORE_POSTGRES:-true}"
RESTORE_MINIO="${RESTORE_MINIO:-true}"
FORCE="${FORCE:-false}"

# Usage
usage() {
    cat <<EOF
Usage: $0 <backup_path> [options]

Arguments:
  backup_path           Chemin vers le répertoire de backup à restaurer

Options:
  Les options sont passées via des variables d'environnement:

  RESTORE_POSTGRES=true|false    Restaurer PostgreSQL (défaut: true)
  RESTORE_MINIO=true|false       Restaurer MinIO (défaut: true)
  FORCE=true|false               Forcer la restauration sans confirmation (défaut: false)

  POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
  MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY

Exemples:
  # Restauration complète
  $0 ./backups/20250126_120000

  # Restauration PostgreSQL uniquement
  RESTORE_MINIO=false $0 ./backups/20250126_120000

  # Restauration avec un autre hôte PostgreSQL
  POSTGRES_HOST=prod-db.example.com $0 ./backups/20250126_120000

  # Restauration forcée (sans confirmation)
  FORCE=true $0 ./backups/20250126_120000
EOF
}

# Vérification des arguments
if [ -z "$BACKUP_PATH" ]; then
    log_error "Aucun chemin de backup spécifié"
    echo
    usage
    exit 1
fi

if [ ! -d "$BACKUP_PATH" ]; then
    log_error "Le répertoire de backup n'existe pas: $BACKUP_PATH"
    exit 1
fi

# Vérification des dépendances
check_dependencies() {
    log_info "Vérification des dépendances..."

    local missing_deps=()

    if [ "$RESTORE_POSTGRES" = "true" ] && ! command -v psql &> /dev/null; then
        missing_deps+=("psql (postgresql-client)")
    fi

    if [ "$RESTORE_MINIO" = "true" ] && ! command -v mc &> /dev/null; then
        missing_deps+=("mc (minio-client)")
    fi

    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Dépendances manquantes: ${missing_deps[*]}"
        exit 1
    fi

    log_success "Toutes les dépendances sont présentes"
}

# Vérification du backup
verify_backup() {
    log_info "Vérification du backup..."

    local metadata_file="${BACKUP_PATH}/backup_metadata.txt"
    if [ -f "$metadata_file" ]; then
        log_info "Métadonnées trouvées:"
        cat "$metadata_file" | sed 's/^/  /'
        echo
    else
        log_warning "Fichier de métadonnées non trouvé"
    fi

    # Liste des fichiers
    log_info "Contenu du backup:"
    ls -lh "$BACKUP_PATH" | tail -n +2 | awk '{printf "  - %s (%s)\n", $9, $5}'
    echo
}

# Confirmation de l'utilisateur
confirm_restore() {
    if [ "$FORCE" = "true" ]; then
        log_warning "Mode FORCE activé - restauration sans confirmation"
        return 0
    fi

    echo -e "${RED}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║              ⚠️  AVERTISSEMENT IMPORTANT ⚠️              ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════╝${NC}"
    echo
    log_warning "Cette opération va ÉCRASER les données existantes !"
    echo

    if [ "$RESTORE_POSTGRES" = "true" ]; then
        log_info "PostgreSQL sera restauré:"
        log_info "  - Base de données: ${POSTGRES_DB}"
        log_info "  - Hôte: ${POSTGRES_HOST}:${POSTGRES_PORT}"
    fi

    if [ "$RESTORE_MINIO" = "true" ]; then
        log_info "MinIO sera restauré:"
        log_info "  - Endpoint: ${MINIO_ENDPOINT}"
        log_info "  - Buckets: ${MINIO_BUCKET_SOURCES}, ${MINIO_BUCKET_ARTIFACTS}"
    fi

    echo
    read -p "Êtes-vous sûr de vouloir continuer? Tapez 'yes' pour confirmer: " -r
    echo

    if [ "$REPLY" != "yes" ]; then
        log_info "Restauration annulée"
        exit 0
    fi
}

# Restauration PostgreSQL
restore_postgres() {
    log_info "Restauration de PostgreSQL..."

    # Trouver le fichier dump
    local dump_file
    dump_file=$(find "$BACKUP_PATH" -name "postgres_*.sql.gz" | head -n 1)

    if [ -z "$dump_file" ]; then
        log_error "Fichier de dump PostgreSQL non trouvé dans $BACKUP_PATH"
        return 1
    fi

    log_info "Fichier de dump: $(basename "$dump_file")"

    export PGPASSWORD="$POSTGRES_PASSWORD"

    # Décompression et restauration
    log_info "Décompression et restauration en cours..."

    if gunzip -c "$dump_file" | psql \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        --quiet 2>&1 | grep -v "^psql:" | grep -v "^ERROR:  role.*does not exist" || true; then

        log_success "PostgreSQL restauré avec succès"
    else
        log_error "Échec de la restauration PostgreSQL"
        unset PGPASSWORD
        return 1
    fi

    unset PGPASSWORD

    # Vérification
    export PGPASSWORD="$POSTGRES_PASSWORD"
    local table_count
    table_count=$(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
        -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)
    unset PGPASSWORD

    log_info "Tables restaurées: $table_count"
}

# Configuration MinIO client
configure_minio_client() {
    log_info "Configuration du client MinIO..."

    mc alias set qubeless-restore "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" --api S3v4 > /dev/null 2>&1

    if mc admin info qubeless-restore > /dev/null 2>&1; then
        log_success "Client MinIO configuré"
    else
        log_warning "Connexion MinIO établie (info admin non disponible)"
    fi
}

# Restauration MinIO
restore_minio() {
    log_info "Restauration de MinIO..."

    # Trouver l'archive MinIO
    local minio_archive
    minio_archive=$(find "$BACKUP_PATH" -name "minio.tar.gz" | head -n 1)

    if [ -z "$minio_archive" ]; then
        log_error "Archive MinIO non trouvée dans $BACKUP_PATH"
        return 1
    fi

    log_info "Archive MinIO: $(basename "$minio_archive")"

    # Décompression
    local temp_dir
    temp_dir=$(mktemp -d)
    log_info "Décompression dans $temp_dir..."

    tar -xzf "$minio_archive" -C "$temp_dir"

    # Liste des buckets à restaurer
    local buckets=("$MINIO_BUCKET_SOURCES" "$MINIO_BUCKET_ARTIFACTS")

    for bucket in "${buckets[@]}"; do
        local bucket_path="${temp_dir}/minio/${bucket}"

        if [ ! -d "$bucket_path" ]; then
            log_warning "  - Bucket '$bucket' non trouvé dans le backup, ignoré"
            continue
        fi

        log_info "  - Restauration du bucket: $bucket"

        # Créer le bucket s'il n'existe pas
        if ! mc ls "qubeless-restore/$bucket" > /dev/null 2>&1; then
            mc mb "qubeless-restore/$bucket" > /dev/null 2>&1
            log_info "    Bucket '$bucket' créé"
        fi

        # Nettoyer le bucket existant
        log_info "    Nettoyage du bucket existant..."
        mc rm --recursive --force "qubeless-restore/$bucket" > /dev/null 2>&1 || true

        # Copier les fichiers
        if mc mirror --quiet "$bucket_path" "qubeless-restore/$bucket"; then
            local count=$(find "$bucket_path" -type f 2>/dev/null | wc -l || echo "0")
            log_success "    Bucket '$bucket' restauré ($count fichiers)"
        else
            log_error "    Échec de la restauration du bucket '$bucket'"
        fi
    done

    # Nettoyage
    rm -rf "$temp_dir"
    log_success "MinIO restauré avec succès"
}

# Nettoyage
cleanup() {
    log_info "Nettoyage..."
    mc alias remove qubeless-restore > /dev/null 2>&1 || true
}

# Main
main() {
    log_info "=== Qubeless Restore Started ==="
    log_info "Backup path: ${BACKUP_PATH}"
    echo

    # Vérifications
    check_dependencies
    verify_backup

    # Confirmation
    confirm_restore

    echo

    # Configuration MinIO si nécessaire
    if [ "$RESTORE_MINIO" = "true" ]; then
        configure_minio_client
        echo
    fi

    # Restaurations
    if [ "$RESTORE_POSTGRES" = "true" ]; then
        restore_postgres || {
            log_error "Échec de la restauration PostgreSQL"
            cleanup
            exit 1
        }
        echo
    fi

    if [ "$RESTORE_MINIO" = "true" ]; then
        restore_minio || {
            log_warning "Échec de la restauration MinIO (continuant quand même)"
        }
        echo
    fi

    # Nettoyage
    cleanup

    log_success "=== Restore Completed ==="
    log_info "Vérifiez que votre application fonctionne correctement"
}

# Trap pour le nettoyage en cas d'erreur
trap cleanup EXIT

# Exécution
main "$@"
