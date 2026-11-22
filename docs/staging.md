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

## Test accounts (after seed)

Defined in `lib/staging/credentials.ts`:

| Role | Email | Password |
|------|-------|----------|
| Super admin | `staging-superadmin@njd.staging` | `StagingTest12!` |
| CS agent | `staging-cs@njd.staging` | same |
| Supervisor (MANAGEMENT) | `staging-supervisor@njd.staging` | same |
| Management / executive | `staging-management@njd.staging` | same |
| Community management | `staging-community@njd.staging` | same |

**2FA (staff roles):** TOTP secret `JBSWY3DPEHPK3PXP` (staging only). Production 2FA logic is unchanged; staging users are pre-enrolled in the seed script.

**E2E dual-owner unit code:** `STAGING-E2E-GA-DUAL-01`

## Local / CI E2E

```bash
export DATABASE_URL="postgresql://test:test@localhost:5432/test"
export AUTH_SECRET="test-secret-at-least-32-characters-long"
export STAGING=true
npx prisma migrate deploy
npm run db:seed-staging
npm run build:strict
npx playwright install chromium
npm run test:e2e
```

## Seed contents (summary)

- Projects: GREEN AVENUE, JURA, JAMILA NORTH COAST (~310 units)
- Varied handover statuses, finishing types, contract/delivery dates, grace periods
- Arabic and English client names
- 12+ dual-owner units (PRIMARY + CO_OWNER)
- 12+ clients with multiple units
- Handover appointment requests in every `UnitRequestStatus`
- Cases and answered call-log style tickets
- Staging staff users with known passwords and TOTP

## Do not

- Point staging `DATABASE_URL` at production Postgres
- Copy production `uploads/` into staging
- Run `scripts/reset-staging-database.sh` on the production app directory