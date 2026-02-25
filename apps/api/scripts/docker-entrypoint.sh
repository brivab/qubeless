#!/bin/sh
set -e

if [ "$SKIP_DB_MIGRATIONS" = "true" ] || [ "$SKIP_DB_MIGRATIONS" = "1" ]; then
  echo "[entrypoint] SKIP_DB_MIGRATIONS enabled, skipping migrations"
else
  if [ -z "$DATABASE_URL" ]; then
    echo "[entrypoint] DATABASE_URL not set, skipping migrations"
  else
    echo "[entrypoint] prisma generate"
    pnpm --filter @qubeless/api run prisma:generate

    max_attempts="${PRISMA_DEPLOY_MAX_ATTEMPTS:-20}"
    backoff="${PRISMA_DEPLOY_BACKOFF_SEC:-2}"
    attempt=1

    while true; do
      echo "[entrypoint] prisma migrate deploy (attempt $attempt/$max_attempts)"
      if pnpm --filter @qubeless/api run prisma:deploy; then
        break
      fi

      if [ "$attempt" -ge "$max_attempts" ]; then
        echo "[entrypoint] prisma migrate deploy failed after $attempt attempts"
        exit 1
      fi

      attempt=$((attempt + 1))
      echo "[entrypoint] prisma migrate deploy failed, retrying in ${backoff}s"
      sleep "$backoff"
    done

    if [ "$SKIP_DB_SEED" = "true" ] || [ "$SKIP_DB_SEED" = "1" ]; then
      echo "[entrypoint] SKIP_DB_SEED enabled, skipping seed"
    else
      echo "[entrypoint] prisma seed"
      pnpm --filter @qubeless/api run prisma:seed
    fi
  fi
fi

exec node apps/api/dist/main.js
