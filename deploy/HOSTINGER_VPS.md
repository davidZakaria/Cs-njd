# Hostinger VPS deployment — CS-NJD CRM

Deploy **only** this app on your existing VPS without touching other projects.

| Item | Value (isolated) |
|------|------------------|
| VPS IP | `72.61.192.84` |
| Domain | `cs-njd.duckdns.org` |
| App directory | `/var/www/cs-njd` |
| PM2 process name | `cs-njd-crm` |
| App port | `3001` (localhost only) |
| Postgres container | `njd-crm-postgres-prod` |
| Postgres port | `127.0.0.1:5434` |
| Nginx site file | `/etc/nginx/sites-available/cs-njd.duckdns.org` |

**Repo:** https://github.com/davidZakaria/Cs-njd.git

---

## Before you SSH in (one-time, outside VPS)

1. **DuckDNS** — point `cs-njd.duckdns.org` → `72.61.192.84` (A record or DuckDNS update).
2. Wait a few minutes for DNS to propagate.

---

## Step 0 — SSH and inspect (read-only, safe)

```bash
ssh root@72.61.192.84
# or: ssh your-user@72.61.192.84
```

Check what is already running — **do not change anything yet**:

```bash
# Existing PM2 apps (other projects stay untouched)
pm2 list

# Ports in use (we need 3001 and 5434 free on localhost)
ss -tlnp | grep -E ':(3001|5434|80|443)\s' || true

# Existing nginx sites
ls -la /etc/nginx/sites-enabled/

# Existing Docker containers
docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'
```

If **3001** or **5434** is already taken, edit before deploy:

- `deploy/ecosystem.config.cjs` → change `3001`
- `deploy/docker-compose.prod.yml` → change `5434`
- `deploy/nginx-cs-njd.conf.example` → match the app port in `proxy_pass`

---

## Step 1 — Create app directory (isolated path)

```bash
sudo mkdir -p /var/www/cs-njd
sudo chown -R $USER:$USER /var/www/cs-njd
cd /var/www/cs-njd
```

---

## Step 2 — Clone the repo

```bash
cd /var/www/cs-njd

git clone https://github.com/davidZakaria/Cs-njd.git .

# Verify you are in the right folder
pwd
# expected: /var/www/cs-njd
```

---

## Step 3 — Start Postgres (Docker, isolated container)

```bash
cd /var/www/cs-njd

# Set a strong DB password (save it — you need it for .env)
export POSTGRES_PASSWORD="$(openssl rand -base64 24)"
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
# Copy this password somewhere safe before continuing.

docker compose -f deploy/docker-compose.prod.yml up -d

# Wait until healthy
docker ps --filter name=njd-crm-postgres-prod
docker compose -f deploy/docker-compose.prod.yml logs postgres --tail 20
```

Verify Postgres is **only** on localhost:

```bash
ss -tlnp | grep 5434
# should show 127.0.0.1:5434
```

---

## Step 4 — Production `.env`

```bash
cd /var/www/cs-njd

cp .env.example .env
nano .env
```

Set these values (replace placeholders):

```env
DATABASE_URL="postgresql://njd:YOUR_DB_PASSWORD@127.0.0.1:5434/njd_crm?schema=public"
AUTH_SECRET="PASTE_OUTPUT_OF_openssl_rand_base64_32"
AUTH_URL="https://cs-njd.duckdns.org"
BACKUP_DIR="/var/www/cs-njd/backups"
BACKUP_DOCKER_CONTAINER="njd-crm-postgres-prod"
BACKUP_CRON="0 2 * * *"
BACKUP_RETENTION_DAYS="14"
NODE_ENV="production"

# Single super admin (only account created on first deploy)
SUPER_ADMIN_EMAIL="davidsamiii97@gmail.com"
SUPER_ADMIN_PASSWORD="your-chosen-password"
SUPER_ADMIN_NAME="David Sami"
```

Generate `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

Lock down the file:

```bash
chmod 600 .env
mkdir -p backups data/legacy
```

---

## Step 5 — Install, migrate, bootstrap super admin

Requires **Node.js 20+** and **npm**. If missing:

```bash
node -v || echo "Install Node 20 LTS (nvm or nodesource)"
```

Deploy commands:

```bash
cd /var/www/cs-njd

npm ci

npx prisma migrate deploy
npx prisma generate

# Creates ONLY the super admin from SUPER_ADMIN_* in .env (no staff yet)
npm run db:bootstrap-admin
```

Add CS/management staff **later** when ready:

```bash
# npm run db:sync-staff
```

Optional — import legacy Excel (upload file first, see Step 8):

```bash
# npm run sync:excel
```

---

## Step 6 — Build

```bash
cd /var/www/cs-njd
npm run build:strict
```

If build fails on env validation, double-check `.env` (`AUTH_SECRET` must be 32+ chars, `AUTH_URL` must be a valid URL).

---

## Step 7 — PM2 (new process only)

Uses `deploy/ecosystem.config.cjs` — process name **`cs-njd-crm`** only.

```bash
cd /var/www/cs-njd

pm2 start deploy/ecosystem.config.cjs
pm2 save

# Confirm ONLY cs-njd-crm was added (other apps unchanged)
pm2 list

# Smoke test on VPS
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/en/login
# expect 200
```

---

## Step 8 — Nginx (new site block only)

Copy the example config — **does not edit other sites**:

```bash
sudo cp /var/www/cs-njd/deploy/nginx-cs-njd.conf.example \
  /etc/nginx/sites-available/cs-njd.duckdns.org

sudo ln -sf /etc/nginx/sites-available/cs-njd.duckdns.org \
  /etc/nginx/sites-enabled/cs-njd.duckdns.org

sudo nginx -t
sudo systemctl reload nginx
```

Test HTTP:

```bash
curl -sI http://cs-njd.duckdns.org | head -5
```

---

## Step 9 — HTTPS (Certbot, this domain only)

```bash
sudo certbot --nginx -d cs-njd.duckdns.org
```

Follow prompts. Certbot updates **only** the `cs-njd.duckdns.org` server block.

Verify:

```bash
curl -sI https://cs-njd.duckdns.org | head -5
```

Open in browser: **https://cs-njd.duckdns.org**

---

## Step 10 — Post-deploy checklist

```bash
cd /var/www/cs-njd

# Staff synced?
npx prisma studio
# or check via app login

# PM2 logs
pm2 logs cs-njd-crm --lines 50

# Postgres health
docker compose -f deploy/docker-compose.prod.yml ps
```

Login with your super admin email from `.env` (`SUPER_ADMIN_EMAIL`).

Add staff later via **Users** in the app, or run `npm run db:sync-staff` on the server.

---

## Optional — Legacy Excel on server

Excel files are **not** in git. Upload from your PC:

```powershell
# From Windows (PowerShell) — adjust paths/user
scp "E:\path\to\workbook.xlsx" root@72.61.192.84:/var/www/cs-njd/data/legacy/
```

On VPS:

```bash
cd /var/www/cs-njd
npm run sync:excel
```

---

## Future updates (safe, one app only)

After changes are pushed to GitHub, on the VPS:

```bash
cd /var/www/cs-njd
chmod +x deploy/update.sh
./deploy/update.sh
```

Or manually:

```bash
cd /var/www/cs-njd
git pull origin main
npm ci
npx prisma migrate deploy
npx prisma generate
npm run build:strict
pm2 restart cs-njd-crm --update-env
pm2 save
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/en/login
```

Expect **200** from the curl check. Then verify in browser: **https://cs-njd.duckdns.org**

---

## Admin ops (production)

**List users**

```bash
docker exec -i njd-crm-postgres-prod psql -U njd -d njd_crm -c 'SELECT email, name, role, "is2FAEnabled" FROM "User" ORDER BY email;'
```

**Reset 2FA for one user** (replace email — must match exactly)

```bash
docker exec -i njd-crm-postgres-prod psql -U njd -d njd_crm -c "UPDATE \"User\" SET \"is2FAEnabled\" = false, \"twoFactorSecret\" = NULL WHERE email = 'user@example.com';"
```

Expect `UPDATE 1`. User signs in again → 2FA setup with QR + manual key.

**Import local database dump** (UTF-8 file only — use `docker cp` from PC, not PowerShell redirect)

```bash
pm2 stop cs-njd-crm
docker exec -i njd-crm-postgres-prod psql -U njd -d njd_crm -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO njd; GRANT ALL ON SCHEMA public TO public;"
docker exec -i njd-crm-postgres-prod psql -U njd -d njd_crm < backups/njd-local-for-vps.sql
npm run db:bootstrap-admin
pm2 restart cs-njd-crm
```

**View app logs**

```bash
pm2 logs cs-njd-crm --lines 50
```

---

## What this does NOT touch

| Resource | Other projects | This deploy |
|----------|----------------|-------------|
| PM2 | Existing processes stay as-is | Adds `cs-njd-crm` only |
| Nginx | Other `sites-enabled` unchanged | New file `cs-njd.duckdns.org` |
| Docker | Other containers unchanged | New `njd-crm-postgres-prod` + volume `njd_crm_pg_prod` |
| Ports | 80/443 shared via nginx (normal) | App `3001`, DB `5434` bound to 127.0.0.1 |
| `/var/www/*` | Other app folders untouched | Only `/var/www/cs-njd` |

---

## Troubleshooting

**Port 3001 in use**

```bash
ss -tlnp | grep 3001
# Change port in ecosystem.config.cjs and nginx proxy_pass, then rebuild/restart
```

**Port 5434 in use**

```bash
ss -tlnp | grep 5434
# Change deploy/docker-compose.prod.yml host port and DATABASE_URL in .env
```

**502 Bad Gateway**

```bash
pm2 logs cs-njd-crm --lines 100
curl http://127.0.0.1:3001
```

**Database connection failed**

```bash
docker compose -f deploy/docker-compose.prod.yml logs postgres
grep DATABASE_URL .env
```

**Auth/cookies issues**

Ensure `AUTH_URL=https://cs-njd.duckdns.org` matches the URL you use in the browser.

**2FA / QR code issues**

Reset the user's 2FA (see Admin ops above), redeploy latest code, then have them sign in again. On setup they can use **Copy key** for Google Authenticator manual entry if QR scan fails.

---

## Quick reference

```bash
# Logs
pm2 logs cs-njd-crm

# Restart app only
pm2 restart cs-njd-crm

# Restart DB only
docker compose -f /var/www/cs-njd/deploy/docker-compose.prod.yml restart

# Stop this app only (others keep running)
pm2 stop cs-njd-crm
docker compose -f /var/www/cs-njd/deploy/docker-compose.prod.yml stop
```
