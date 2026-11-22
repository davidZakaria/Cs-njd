# Staging environment — CS-NJD CRM

Staging runs **alongside production** on the same Hostinger VPS with **fully isolated** Postgres, env file, uploads directory, PM2 process, and port. It uses **fake data only** (`npm run db:seed-staging`). Never copy production client data or `.env` secrets into staging.

Suggested public URL: **https://staging.njd-crm.com** (DNS A record → same VPS IP as production).

## What gets isolated

| Resource | Production | Staging |
|----------|------------|---------|
| App directory | `/var/www/cs-njd` | `/var/www/cs-njd-staging` |
| PM2 name | `cs-njd-crm` | `cs-njd-crm-staging` |
| HTTP port | `3001` | `3002` |
| Postgres container | `njd-crm-postgres-prod` | `njd-crm-postgres-staging` |
| DB port (host) | `127.0.0.1:5434` | `127.0.0.1:5435` |
| Database name | `njd_crm` | `njd_crm_staging` |
| Uploads | `./uploads` | `./uploads-staging` |

## One-time VPS setup (paste in Hostinger web console)

```bash
# 1) Clone staging tree (separate from production)
sudo mkdir -p /var/www/cs-njd-staging
sudo chown "$USER:$USER" /var/www/cs-njd-staging
git clone https://github.com/davidZakaria/Cs-njd.git /var/www/cs-njd-staging
cd /var/www/cs-njd-staging

# 2) Env file (no secrets in git — edit passwords on server)
cp .env.staging.example .env
nano .env
# Set: AUTH_SECRET (32+ chars), AUTH_URL=https://staging.njd-crm.com
# Set: DATABASE_URL with njd_staging user/password matching docker compose
# Set: POSTGRES_STAGING_PASSWORD in shell or .env for compose

# 3) Staging Postgres
export POSTGRES_STAGING_PASSWORD='YOUR_STRONG_STAGING_PASSWORD'
docker compose -f deploy/docker-compose.staging.yml --env-file .env up -d

# 4) Migrate + fake seed
npm ci --legacy-peer-deps
npx prisma migrate deploy
STAGING=true npm run db:seed-staging

# 5) Build + PM2 (staging only)
npm run build:strict
pm2 start deploy/ecosystem.staging.config.cjs
pm2 save

# 6) Nginx (after DNS for staging.njd-crm.com points to VPS)
sudo cp deploy/nginx-njd-crm-staging.conf.example /etc/nginx/sites-available/njd-crm-staging
sudo ln -sf /etc/nginx/sites-available/njd-crm-staging /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d staging.njd-crm.com
```

## Deploy updates to staging

```bash
cd /var/www/cs-njd-staging
bash deploy/update-staging.sh
```

This script does **not** restart `cs-njd-crm` or production Postgres.

## Reset staging (wipe DB + re-seed fake data)

```bash
cd /var/www/cs-njd-staging
chmod +x scripts/reset-staging-database.sh
bash scripts/reset-staging-database.sh
```

Requirements checked by the script:

- `STAGING=true` in `.env`
- `DATABASE_URL` contains `njd_crm_staging` or port `5435`

## Securing public staging

`staging.njd-crm.com` must **not** rely on passwords committed to git.

1. Set unique `STAGING_E2E_PASSWORD` and `STAGING_TOTP_SECRET` in `.env` before `npm run db:seed-staging`.
2. Enable **nginx basic auth** (see `deploy/nginx-njd-crm-staging.conf.example`) and/or restrict by **IP allowlist** / firewall.
3. App login + staff 2FA remain enabled (production code path unchanged).

## Test accounts (after seed)

Emails are fixed in `lib/staging/credentials.ts`. Password and TOTP come from your `.env` (see above).

| Role | Email |
|------|-------|
| Super admin | `staging-superadmin@njd.staging` |
| CS agent | `staging-cs@njd.staging` |
| Supervisor (MANAGEMENT) | `staging-supervisor@njd.staging` |
| Management / executive | `staging-management@njd.staging` |
| Community management | `staging-community@njd.staging` |

**E2E owner-shape unit codes:** `STAGING-E2E-MERGED-SLASH-01`, `STAGING-E2E-LEGACY-COOWNER-01`, `STAGING-E2E-GA-DUAL-01`

## Local / CI E2E

```bash
export DATABASE_URL="postgresql://test:test@localhost:5432/test"
export AUTH_SECRET="test-secret-at-least-32-characters-long"
export STAGING=true
export STAGING_E2E_USE_DEFAULT_SECRETS=true   # CI only — never on public VPS
npx prisma migrate deploy
npm run db:seed-staging
npm run build:strict
npx playwright install chromium
npm run test:e2e
```

## Seed contents (summary)

- Projects: GREEN AVENUE, JURA, JAMILA NORTH COAST (~310+ units)
- Production-like shapes: merged `name` with `/` (legacy primary block only), spelling variants (`نصر الله` vs `نصرالله`), legacy phone strings, grace period `0`, contract price `0`, units without finishing rows
- Clean dual-owner rows (two `UnitClient` links) alongside legacy patterns
- Handover appointment requests in every `UnitRequestStatus`
- Cases and answered call-log style tickets

## Do not

- Point staging `DATABASE_URL` at production Postgres
- Copy production `uploads/` into staging
- Run `scripts/reset-staging-database.sh` on the production app directory