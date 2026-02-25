#!/usr/bin/env bash
set -euo pipefail

# Script to build all analyzer Docker images with proper tags
# Usage: ./scripts/build-analyzers.sh [--no-cache]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ANALYZERS_DIR="$REPO_ROOT/analyzers"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
NO_CACHE=""
if [[ "${1:-}" == "--no-cache" ]]; then
  NO_CACHE="--no-cache"
  echo -e "${YELLOW}Building with --no-cache flag${NC}"
fi

# Docker registry/tag (align with prisma seed env vars)
ANALYZER_REGISTRY="${ANALYZER_IMAGE_REGISTRY:-${DOCKER_REGISTRY:-qubeless}}"
ANALYZER_TAG="${ANALYZER_IMAGE_TAG:-latest}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Building Analyzer Docker Images${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Find all analyzer directories with a Dockerfile
ANALYZERS=()
while IFS= read -r -d '' analyzer_path; do
  analyzer_name=$(basename "$analyzer_path")
  if [[ -f "$analyzer_path/Dockerfile" ]]; then
    ANALYZERS+=("$analyzer_name")
  fi
done < <(find "$ANALYZERS_DIR" -maxdepth 1 -type d ! -path "$ANALYZERS_DIR" -print0 | sort -z)

if [[ ${#ANALYZERS[@]} -eq 0 ]]; then
  echo -e "${RED}No analyzers found in $ANALYZERS_DIR${NC}"
  exit 1
fi

echo -e "${GREEN}Found ${#ANALYZERS[@]} analyzer(s):${NC}"
for analyzer in "${ANALYZERS[@]}"; do
  echo "  - $analyzer"
done
echo ""

# Build counters
SUCCESS_COUNT=0
FAILED_COUNT=0
FAILED_ANALYZERS=()

# Build each analyzer
for analyzer in "${ANALYZERS[@]}"; do
  analyzer_path="$ANALYZERS_DIR/$analyzer"
  image_name="$ANALYZER_REGISTRY/analyzer-$analyzer:$ANALYZER_TAG"

  echo -e "${BLUE}----------------------------------------${NC}"
  echo -e "${BLUE}Building: $analyzer${NC}"
  echo -e "${BLUE}Image: $image_name${NC}"
  echo -e "${BLUE}Path: $analyzer_path${NC}"
  echo -e "${BLUE}----------------------------------------${NC}"

  # Build the image
  if docker build $NO_CACHE -t "$image_name" "$analyzer_path"; then
    echo -e "${GREEN}✓ Successfully built $image_name${NC}"
    ((SUCCESS_COUNT+=1))
  else
    echo -e "${RED}✗ Failed to build $image_name${NC}"
    ((FAILED_COUNT+=1))
    FAILED_ANALYZERS+=("$analyzer")
  fi

  echo ""
done

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Build Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Successful: $SUCCESS_COUNT${NC}"
echo -e "${RED}Failed: $FAILED_COUNT${NC}"

if [[ $FAILED_COUNT -gt 0 ]]; then
  echo ""
  echo -e "${RED}Failed analyzers:${NC}"
  for analyzer in "${FAILED_ANALYZERS[@]}"; do
    echo -e "${RED}  - $analyzer${NC}"
  done
  exit 1
fi

echo ""
echo -e "${GREEN}All analyzers built successfully!${NC}"
echo ""
echo -e "${BLUE}Built images:${NC}"
docker images --filter "reference=${ANALYZER_REGISTRY}/analyzer-*:${ANALYZER_TAG}" \
  --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
