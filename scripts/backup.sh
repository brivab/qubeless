#!/usr/bin/env bash
set -euo pipefail

#######################################
# Qubeless Backup Script
# Sauvegarde PostgreSQL et MinIO
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
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_TIMESTAMP="${BACKUP_TIMESTAMP:-$(date +%Y%m%d_%H%M%S)}"

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

# Vérification des dépendances
check_dependencies() {
    log_info "Vérification des dépendances..."

    local missing_deps=()

    if ! command -v pg_dump &> /dev/null; then
        missing_deps+=("pg_dump (postgresql-client)")
    fi

    if ! command -v mc &> /dev/null; then
        missing_deps+=("mc (minio-client)")
    fi

    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Dépendances manquantes: ${missing_deps[*]}"
        log_info "Installation:"
        log_info "  - PostgreSQL client: apt-get install postgresql-client (ou brew install postgresql)"
        log_info "  - MinIO client: https://min.io/docs/minio/linux/reference/minio-mc.html"
        exit 1
    fi

    log_success "Toutes les dépendances sont présentes"
}

# Création du répertoire de backup
create_backup_dir() {
    local backup_path="${BACKUP_DIR}/${BACKUP_TIMESTAMP}"

    if [ -d "$backup_path" ]; then
        log_warning "Le répertoire de backup existe déjà: $backup_path"
        read -p "Voulez-vous continuer et écraser les fichiers existants? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Backup annulé"
            exit 0
        fi
    fi

    mkdir -p "$backup_path"
    log_success "Répertoire de backup créé: $backup_path"
    echo "$backup_path"
}

# Backup PostgreSQL
backup_postgres() {
    local backup_path="$1"
    local db_file="${backup_path}/postgres_${POSTGRES_DB}.sql"

    log_info "Sauvegarde de PostgreSQL (${POSTGRES_DB})..."

    export PGPASSWORD="$POSTGRES_PASSWORD"

    if pg_dump \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        --clean \
        --if-exists \
        --verbose \
        -f "$db_file" 2>&1 | grep -v "^pg_dump:"; then

        # Compression du dump
        gzip "$db_file"
        log_success "PostgreSQL sauvegardé: ${db_file}.gz ($(du -h "${db_file}.gz" | cut -f1))"
    else
        log_error "Échec de la sauvegarde PostgreSQL"
        return 1
    fi

    unset PGPASSWORD
}

# Configuration MinIO client
configure_minio_client() {
    log_info "Configuration du client MinIO..."

    # Alias temporaire pour cette session
    mc alias set qubeless-backup "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" --api S3v4 > /dev/null 2>&1

    if mc admin info qubeless-backup > /dev/null 2>&1; then
        log_success "Client MinIO configuré"
    else
        log_warning "Connexion MinIO établie (info admin non disponible)"
    fi
}

# Backup MinIO
backup_minio() {
    local backup_path="$1"
    local minio_dir="${backup_path}/minio"

    mkdir -p "$minio_dir"

    log_info "Sauvegarde de MinIO..."

    # Liste des buckets à sauvegarder
    local buckets=("$MINIO_BUCKET_SOURCES" "$MINIO_BUCKET_ARTIFACTS")

    for bucket in "${buckets[@]}"; do
        log_info "  - Sauvegarde du bucket: $bucket"

        # Vérifier si le bucket existe
        if ! mc ls "qubeless-backup/$bucket" > /dev/null 2>&1; then
            log_warning "    Bucket '$bucket' n'existe pas ou est vide, ignoré"
            continue
        fi

        # Mirror le bucket
        if mc mirror --quiet "qubeless-backup/$bucket" "${minio_dir}/${bucket}"; then
            local size=$(du -sh "${minio_dir}/${bucket}" 2>/dev/null | cut -f1 || echo "0")
            local count=$(find "${minio_dir}/${bucket}" -type f 2>/dev/null | wc -l || echo "0")
            log_success "    Bucket '$bucket' sauvegardé: $size ($count fichiers)"
        else
            log_error "    Échec de la sauvegarde du bucket '$bucket'"
        fi
    done

    # Archiver les buckets
    log_info "Compression de MinIO..."
    tar -czf "${minio_dir}.tar.gz" -C "$backup_path" "minio" 2>/dev/null
    rm -rf "$minio_dir"
    log_success "MinIO compressé: ${minio_dir}.tar.gz ($(du -h "${minio_dir}.tar.gz" | cut -f1))"
}

# Créer un fichier de métadonnées
create_metadata() {
    local backup_path="$1"
    local metadata_file="${backup_path}/backup_metadata.txt"

    cat > "$metadata_file" <<EOF
Qubeless Backup Metadata
========================
Date: $(date)
Timestamp: ${BACKUP_TIMESTAMP}

PostgreSQL:
  Host: ${POSTGRES_HOST}:${POSTGRES_PORT}
  Database: ${POSTGRES_DB}
  User: ${POSTGRES_USER}

MinIO:
  Endpoint: ${MINIO_ENDPOINT}
  Buckets: ${MINIO_BUCKET_SOURCES}, ${MINIO_BUCKET_ARTIFACTS}

Backup Location: ${backup_path}
EOF

    log_success "Métadonnées créées: $metadata_file"
}

# Nettoyage
cleanup() {
    log_info "Nettoyage..."
    mc alias remove qubeless-backup > /dev/null 2>&1 || true
}

# Main
main() {
    log_info "=== Qubeless Backup Started ==="
    log_info "Timestamp: ${BACKUP_TIMESTAMP}"
    echo

    # Vérifications
    check_dependencies

    # Création du répertoire de backup
    BACKUP_PATH=$(create_backup_dir)

    # Configuration MinIO
    configure_minio_client

    echo

    # Backups
    backup_postgres "$BACKUP_PATH" || {
        log_error "Échec du backup PostgreSQL"
        cleanup
        exit 1
    }

    echo

    backup_minio "$BACKUP_PATH" || {
        log_warning "Échec du backup MinIO (continuant quand même)"
    }

    echo

    # Métadonnées
    create_metadata "$BACKUP_PATH"

    # Nettoyage
    cleanup

    echo
    log_success "=== Backup Completed ==="
    log_info "Location: $BACKUP_PATH"
    log_info "Taille totale: $(du -sh "$BACKUP_PATH" | cut -f1)"

    # Liste des fichiers
    echo
    log_info "Fichiers créés:"
    ls -lh "$BACKUP_PATH" | tail -n +2 | awk '{printf "  - %s (%s)\n", $9, $5}'
}

# Trap pour le nettoyage en cas d'erreur
trap cleanup EXIT

# Exécution
main "$@"
