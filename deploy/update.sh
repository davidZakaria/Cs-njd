#!/usr/bin/env bash
# Safe update script for CS-NJD CRM on VPS — only touches this app.
set -euo pipefail

APP_DIR="/var/www/cs-njd"
PM2_NAME="cs-njd-crm"
BACKUP_CRON_NAME="cs-njd-backup-cron"

cd "$APP_DIR"

echo "==> Pull latest code"
git pull origin main

echo "==> Ensure upload directory"
mkdir -p uploads/signed-protocols uploads/national-ids uploads/signed-contracts uploads/extension-annexes uploads/finishing-contracts

echo "==> Install dependencies"
npm ci --legacy-peer-deps

echo "==> Ensure Chromium for official handover PDF generation"
if command -v chromium >/dev/null 2>&1; then
  CHROME_BIN="$(command -v chromium)"
elif command -v chromium-browser >/dev/null 2>&1; then
  CHROME_BIN="$(command -v chromium-browser)"
else
  echo "    Installing chromium + Arabic font packages (sudo)…"
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    chromium-browser fonts-noto-core fonts-noto-ui-core 2>/dev/null || \
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    chromium fonts-noto-core fonts-noto-ui-core
  CHROME_BIN="$(command -v chromium-browser 2>/dev/null || command -v chromium)"
fi
if [[ -n "${CHROME_BIN:-}" ]]; then
  grep -q PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH .env 2>/dev/null || \
    echo "PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=${CHROME_BIN}" >> .env
  export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$CHROME_BIN"
  echo "    Using Chromium at ${CHROME_BIN}"
else
  echo "    WARNING: Chromium not found — official handover PDF generation will fail until installed."
fi

echo "==> Run migrations"
npx prisma migrate deploy
npx prisma generate

echo "==> Build"
npm run build:strict

echo "==> Restart PM2 app ($PM2_NAME only)"
pm2 restart "$PM2_NAME" --update-env
if pm2 describe "$BACKUP_CRON_NAME" >/dev/null 2>&1; then
  pm2 restart "$BACKUP_CRON_NAME" --update-env
else
  echo "==> Start backup cron ($BACKUP_CRON_NAME)"
  pm2 start deploy/ecosystem.config.cjs --only "$BACKUP_CRON_NAME"
fi
pm2 save

echo "==> Smoke test"
sleep 2
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:3001/en/login || true

echo "==> Done"
pm2 status "$PM2_NAME"
