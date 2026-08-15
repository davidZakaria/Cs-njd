#!/usr/bin/env bash
# Safe update script for CS-NJD CRM on VPS — only touches this app.
set -euo pipefail

APP_DIR="/var/www/cs-njd"
PM2_NAME="cs-njd-crm"

cd "$APP_DIR"

echo "==> Pull latest code"
git pull origin main

echo "==> Install dependencies"
npm ci

echo "==> Run migrations"
npx prisma migrate deploy
npx prisma generate

echo "==> Build"
npm run build:strict

echo "==> Restart PM2 app ($PM2_NAME only)"
pm2 restart "$PM2_NAME" --update-env
pm2 save

echo "==> Smoke test"
sleep 2
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:3001/en/login || true

echo "==> Done"
pm2 status "$PM2_NAME"
