#!/usr/bin/env bash
# Safe update for STAGING only — does not restart production cs-njd-crm.
set -euo pipefail

APP_DIR="${STAGING_APP_DIR:-/var/www/cs-njd-staging}"
PM2_NAME="cs-njd-crm-staging"
COMPOSE_FILE="deploy/docker-compose.staging.yml"

cd "$APP_DIR"

echo "==> Pull latest code"
git pull origin main

echo "==> Ensure staging upload directory"
mkdir -p uploads-staging/signed-protocols uploads-staging/national-ids \
  uploads-staging/signed-contracts uploads-staging/extension-annexes \
  uploads-staging/finishing-contracts

echo "==> Install dependencies"
npm ci --legacy-peer-deps

echo "==> Ensure Chromium for official handover PDF generation"
if command -v chromium >/dev/null 2>&1; then
  CHROME_BIN="$(command -v chromium)"
elif command -v chromium-browser >/dev/null 2>&1; then
  CHROME_BIN="$(command -v chromium-browser)"
else
  echo "    WARNING: Chromium not found — install chromium-browser on the VPS."
  CHROME_BIN=""
fi
if [[ -n "${CHROME_BIN:-}" ]]; then
  grep -q PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH .env 2>/dev/null || \
    echo "PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=${CHROME_BIN}" >> .env
  export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$CHROME_BIN"
fi

echo "==> Start staging Postgres (if not running)"
docker compose -f "$COMPOSE_FILE" --env-file .env up -d

echo "==> Run migrations"
npx prisma migrate deploy
npx prisma generate

echo "==> Build"
npm run build:strict

echo "==> Restart PM2 staging ($PM2_NAME only)"
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env
else
  pm2 start deploy/ecosystem.staging.config.cjs
fi
pm2 save

echo "==> Smoke test"
sleep 2
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:3002/en/login || true

echo "==> Done (staging). Production PM2 apps were not touched."
pm2 status "$PM2_NAME"