#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=================================="
echo "Qubeless Production Config Validator"
echo "=================================="
echo ""

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${RED}✗ .env.production file not found${NC}"
    echo -e "${YELLOW}→ Create .env.production and populate it with the variables listed in docs/en/deploy.md (.env.production Example section)${NC}"
    exit 1
fi

echo -e "${GREEN}✓ .env.production file found${NC}"

# Source the .env.production file
set -a
source .env.production
set +a

# Required variables
REQUIRED_VARS=(
    "POSTGRES_PASSWORD"
    "MINIO_ROOT_USER"
    "MINIO_ROOT_PASSWORD"
    "MINIO_PUBLIC_ENDPOINT"
    "JWT_SECRET"
    "ADMIN_EMAIL"
    "ADMIN_PASSWORD"
    "FRONTEND_ORIGIN"
    "VITE_API_URL"
)

echo ""
echo "Checking required variables..."
echo ""

MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}✗ $var is not set${NC}"
        MISSING_VARS+=("$var")
    else
        # Check for default/example values that should be changed
        case "$var" in
            *PASSWORD*|*SECRET*|*KEY*)
                if [[ "${!var}" == *"changeme"* ]] || [[ "${!var}" == *"test"* ]] || [[ "${!var}" == *"example"* ]]; then
                    echo -e "${YELLOW}⚠ $var appears to use a default/test value${NC}"
                else
                    echo -e "${GREEN}✓ $var is set${NC}"
                fi
                ;;
            ADMIN_EMAIL)
                if [[ "${!var}" == "admin@example.com" ]]; then
                    echo -e "${YELLOW}⚠ $var is using the example value${NC}"
                else
                    echo -e "${GREEN}✓ $var is set${NC}"
                fi
                ;;
            *ENDPOINT*|*ORIGIN*|*URL*)
                if [[ "${!var}" == *"example.com"* ]] || [[ "${!var}" == *"localhost"* ]]; then
                    echo -e "${YELLOW}⚠ $var appears to use an example/localhost URL${NC}"
                else
                    echo -e "${GREEN}✓ $var is set${NC}"
                fi
                ;;
            *)
                echo -e "${GREEN}✓ $var is set${NC}"
                ;;
        esac
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo ""
    echo -e "${RED}Missing required variables: ${MISSING_VARS[*]}${NC}"
    exit 1
fi

echo ""
echo "Validating Docker Compose configuration..."
echo ""

# Validate docker-compose syntax
if docker-compose -f docker-compose.prod.yml --env-file .env.production config --quiet 2>/dev/null; then
    echo -e "${GREEN}✓ Docker Compose configuration is valid${NC}"
else
    echo -e "${RED}✗ Docker Compose configuration has errors${NC}"
    docker-compose -f docker-compose.prod.yml --env-file .env.production config 2>&1
    exit 1
fi

# Check JWT_SECRET strength
if [ ${#JWT_SECRET} -lt 32 ]; then
    echo -e "${YELLOW}⚠ JWT_SECRET should be at least 32 characters long${NC}"
fi

# Check if directories exist
echo ""
echo "Checking directories..."
echo ""

DIRS=(
    "${DATA_DIR:-.}/volumes/postgres"
    "${DATA_DIR:-.}/volumes/redis"
    "${DATA_DIR:-.}/volumes/minio"
    "backups/postgres"
    "backups/minio"
)

for dir in "${DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓ $dir exists${NC}"
    else
        echo -e "${YELLOW}⚠ $dir does not exist (will be created on first run)${NC}"
    fi
done

# Check /tmp directories
echo ""
if [ -d "/tmp/workspaces" ] && [ -d "/tmp/analyzer-out" ]; then
    echo -e "${GREEN}✓ Temporary directories exist${NC}"
else
    echo -e "${YELLOW}⚠ Temporary directories missing (will be created on first run)${NC}"
fi

# Summary
echo ""
echo "=================================="
echo -e "${GREEN}Configuration validation complete!${NC}"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Review any warnings above"
echo "2. Create missing directories: mkdir -p volumes/{postgres,redis,minio} backups/{postgres,minio} /tmp/{workspaces,analyzer-out}"
echo "3. Start services: docker-compose -f docker-compose.prod.yml --env-file .env.production up -d"
echo ""
