#!/usr/bin/env bash
# Finish domain cutover after DNS points to this VPS (72.61.192.84).
#
# Usage:
#   bash deploy/setup-domain.sh                    # default: app.njd-crm.com
#   bash deploy/setup-domain.sh njd-crm.com        # apex (needs all @ A → VPS)
#   bash deploy/setup-domain.sh app.njd-crm.com
set -euo pipefail

APP_DIR="/var/www/cs-njd"
PM2_NAME="cs-njd-crm"
EMAIL="${CERTBOT_EMAIL:-davidsamii3@gmail.com}"
DOMAIN="${1:-app.njd-crm.com}"

echo "==> Issue / renew Let's Encrypt cert for $DOMAIN"
if [[ "$DOMAIN" == "njd-crm.com" ]]; then
  certbot --nginx -d njd-crm.com -d www.njd-crm.com \
    --non-interactive --agree-tos -m "$EMAIL" --redirect
else
  certbot --nginx -d "$DOMAIN" \
    --non-interactive --agree-tos -m "$EMAIL" --redirect
fi

echo "==> Set AUTH_URL to https://$DOMAIN"
ENV_FILE="$APP_DIR/.env"
if grep -q '^AUTH_URL=' "$ENV_FILE"; then
  sed -i "s|^AUTH_URL=.*|AUTH_URL=\"https://${DOMAIN}\"|" "$ENV_FILE"
else
  echo "AUTH_URL=\"https://${DOMAIN}\"" >> "$ENV_FILE"
fi

echo "==> Pull latest app"
cd "$APP_DIR"
git pull origin main
npm ci
npm run build:strict

echo "==> Restart app"
pm2 restart "$PM2_NAME" --update-env

echo "==> Smoke test"
sleep 2
curl -sI "https://${DOMAIN}/en/login" | head -5

echo "==> Done — use https://${DOMAIN}"
