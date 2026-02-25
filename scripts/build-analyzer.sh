#!/usr/bin/env bash
set -euo pipefail

# Script to build a specific analyzer Docker image
# Usage: ./scripts/build-analyzer.sh <analyzer-name> [--no-cache]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ANALYZERS_DIR="$REPO_ROOT/analyzers"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check arguments
if [[ $# -lt 1 ]]; then
  echo -e "${RED}Error: Missing analyzer name${NC}"
  echo ""
  echo "Usage: $0 <analyzer-name> [--no-cache]"
  echo ""
  echo "Available analyzers:"
  find "$ANALYZERS_DIR" -maxdepth 1 -type d ! -path "$ANALYZERS_DIR" -exec basename {} \; | sort | sed 's/^/  - /'
  exit 1
fi

ANALYZER_NAME="$1"
NO_CACHE=""

if [[ "${2:-}" == "--no-cache" ]]; then
  NO_CACHE="--no-cache"
  echo -e "${YELLOW}Building with --no-cache flag${NC}"
fi

# Docker registry (can be overridden with env var)
DOCKER_REGISTRY="${DOCKER_REGISTRY:-qubeless}"

ANALYZER_PATH="$ANALYZERS_DIR/$ANALYZER_NAME"
IMAGE_NAME="$DOCKER_REGISTRY/analyzer-$ANALYZER_NAME:latest"

# Check if analyzer exists
if [[ ! -d "$ANALYZER_PATH" ]]; then
  echo -e "${RED}Error: Analyzer '$ANALYZER_NAME' not found${NC}"
  echo ""
  echo "Available analyzers:"
  find "$ANALYZERS_DIR" -maxdepth 1 -type d ! -path "$ANALYZERS_DIR" -exec basename {} \; | sort | sed 's/^/  - /'
  exit 1
fi

# Check if Dockerfile exists
if [[ ! -f "$ANALYZER_PATH/Dockerfile" ]]; then
  echo -e "${RED}Error: No Dockerfile found in $ANALYZER_PATH${NC}"
  exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Building Analyzer: $ANALYZER_NAME${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Image: $IMAGE_NAME${NC}"
echo -e "${BLUE}Path: $ANALYZER_PATH${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Build the image
if docker build $NO_CACHE -t "$IMAGE_NAME" "$ANALYZER_PATH"; then
  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}✓ Successfully built $IMAGE_NAME${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""

  # Show image details
  docker images "$IMAGE_NAME" --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
else
  echo ""
  echo -e "${RED}========================================${NC}"
  echo -e "${RED}✗ Failed to build $IMAGE_NAME${NC}"
  echo -e "${RED}========================================${NC}"
  exit 1
fi
