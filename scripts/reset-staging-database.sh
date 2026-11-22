#!/usr/bin/env bash
# Wipes STAGING database volume and re-seeds fake data. Never run against production paths.
set -euo pipefail

APP_DIR="${STAGING_APP_DIR:-/var/www/cs-njd-staging}"
COMPOSE_FILE="deploy/docker-compose.staging.yml"

cd "$APP_DIR"

if [[ ! -f .env ]]; then
  echo "Missing .env in $APP_DIR — copy from .env.staging.example first."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [[ "${STAGING:-}" != "true" ]]; then
  echo "Refusing reset: set STAGING=true in .env"
  exit 1
fi

if [[ "${DATABASE_URL:-}" != *"njd_crm_staging"* ]] && [[ "${DATABASE_URL:-}" != *"5435"* ]]; then
  echo "Refusing reset: DATABASE_URL does not look like staging (expected njd_crm_staging or port 5435)"
  exit 1
fi

read -r -p "This DESTROYS all staging data. Continue? [y/N] " confirm
if [[ "${confirm,,}" != "y" ]]; then
  echo "Aborted."
  exit 0
fi

echo "==> Stop staging app"
pm2 stop cs-njd-crm-staging 2>/dev/null || true

echo "==> Recreate Postgres volume"
docker compose -f "$COMPOSE_FILE" --env-file .env down -v
docker compose -f "$COMPOSE_FILE" --env-file .env up -d

echo "==> Wait for Postgres"
for _ in $(seq 1 30); do
  if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U njd_staging -d njd_crm_staging >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "==> Migrate and seed"
export STAGING_RESET=true
npx prisma migrate deploy
npm run db:seed-staging

echo "==> Restart staging"
pm2 restart cs-njd-crm-staging --update-env || pm2 start deploy/ecosystem.staging.config.cjs

echo "==> Staging reset complete"