#!/bin/sh
set -eu

SOURCE_NAMESPACE="qubeless"
GH_OWNER="blockvab"
REGISTRY="ghcr.io"
TAG="latest"

IMAGES="
analyzer-bandit
analyzer-checkstyle
analyzer-complexity
analyzer-eslint
analyzer-golangci-lint
analyzer-jscpd
analyzer-mypy
analyzer-pmd
analyzer-pylint
analyzer-semgrep
analyzer-spotbugs
analyzer-trivy
"

require_local_image() {
  img="$1"
  if ! docker image inspect "$img" >/dev/null 2>&1; then
    echo "❌ Image locale introuvable: $img"
    echo "   (Vu que le pull est refusé, il faut que l'image existe déjà en local.)"
    exit 1
  fi
}

retry_push() {
  img="$1"
  n=1
  while [ $n -le 3 ]; do
    echo "⬆️  Push (tentative $n/3) $img"
    if docker push "$img"; then
      return 0
    fi
    n=$((n+1))
    echo "⚠️  Push échoué, retry..."
    sleep 2
  done
  echo "❌ Push impossible: $img"
  exit 1
}

echo "🔐 Assure-toi d'être loggé sur GHCR :"
echo "   echo \"\$GHCR_TOKEN\" | docker login ghcr.io -u ${GH_OWNER} --password-stdin"
echo ""

for NAME in $IMAGES; do
  SRC="${SOURCE_NAMESPACE}/${NAME}:${TAG}"
  DST="${REGISTRY}/${GH_OWNER}/${NAME}:${TAG}"

  echo "--------------------------------------"
  echo "🔎 Vérif image locale: $SRC"
  require_local_image "$SRC"

  echo "🧱 Réhydratation layers (docker save | docker load) : $SRC"
  # Le load va réimporter l'image proprement dans le store local
  docker save "$SRC" | docker load >/dev/null

  echo "➡️  Tag $SRC -> $DST"
  docker tag "$SRC" "$DST"

  retry_push "$DST"

  echo "✅ Done: $DST"
done

echo "🎉 Toutes les images ont été push sur GHCR."
