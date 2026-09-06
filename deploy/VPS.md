# Deploy on VPS (after git push)

Run these on the server as **root**:

```bash
ssh root@72.61.192.84
cd /var/www/cs-njd
bash deploy/update.sh
```

## If `git pull` fails

```bash
cd /var/www/cs-njd
git checkout -- deploy/update.sh
git pull origin main
bash deploy/update.sh
```

## If you get 502 after a reboot

```bash
pm2 resurrect
pm2 save
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:3001/en/login
```

## Backups not working (Docker Postgres)

Add to `/var/www/cs-njd/.env`:

```env
BACKUP_DOCKER_CONTAINER="njd-crm-postgres-prod"
BACKUP_CRON="0 2 * * *"
BACKUP_RETENTION_DAYS="14"
```

Start the daily backup worker (once after deploy):

```bash
cd /var/www/cs-njd
pm2 start deploy/ecosystem.config.cjs --only cs-njd-backup-cron
pm2 save
```

Or reload all PM2 apps:

```bash
pm2 start deploy/ecosystem.config.cjs
pm2 save
```

Test from **Backups** page → **Run backup now**. Status should become `SUCCESS` with a `.tar.gz` file and contents preview.

Expect **200**. Site: **https://njd-crm.com** (also **https://cs-njd.duckdns.org** legacy)

## Phase 2 network hardening (2026-09-06)

| Layer | Status |
|-------|--------|
| **Nginx rate limit** | Applied — `10r/s` burst 20 on `njd-crm.com` + `cs-njd.duckdns.org`; `server_tokens off` |
| **UFW firewall** | Already active — SSH + Nginx Full (80/443); Postgres on `127.0.0.1:5434` only |
| **Cloudflare** | Manual — follow [`deploy/CLOUDFLARE.md`](CLOUDFLARE.md) |

Re-apply nginx rate limiting after nginx.conf reset:

```bash
bash /var/www/cs-njd/deploy/scripts/apply-nginx-rate-limit.sh
```

## Manual deploy (same as `update.sh`)

```bash
cd /var/www/cs-njd
git pull origin main
npm ci
npx prisma migrate deploy
npx prisma generate
npm run build:strict
pm2 restart cs-njd-crm --update-env
pm2 save
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:3001/en/login
```
