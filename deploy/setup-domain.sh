#!/usr/bin/env bash
# Finish njd-crm.com cutover after GoDaddy A record points to this VPS (72.61.192.84).
set -euo pipefail

APP_DIR="/var/www/cs-njd"
PM2_NAME="cs-njd-crm"
EMAIL="${CERTBOT_EMAIL:-davidsamii3@gmail.com}"

echo "==> Issue / renew Let's Encrypt cert for njd-crm.com"
certbot --nginx -d njd-crm.com -d www.njd-crm.com \
  --non-interactive --agree-tos -m "$EMAIL" --redirect

echo "==> Set AUTH_URL to production domain"
ENV_FILE="$APP_DIR/.env"
if grep -q '^AUTH_URL=' "$ENV_FILE"; then
  sed -i 's|^AUTH_URL=.*|AUTH_URL="https://njd-crm.com"|' "$ENV_FILE"
else
  echo 'AUTH_URL="https://njd-crm.com"' >> "$ENV_FILE"
fi

echo "==> Pull latest app (allowedOrigins, docs)"
cd "$APP_DIR"
git pull origin main
npm ci
npm run build:strict

echo "==> Restart app"
pm2 restart "$PM2_NAME" --update-env

echo "==> Smoke test"
sleep 2
curl -sI https://njd-crm.com/en/login | head -5

echo "==> Done — use https://njd-crm.com"
