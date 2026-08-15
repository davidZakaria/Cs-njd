# Production Deployment Guide

**Hostinger VPS (isolated deploy):** see [`deploy/HOSTINGER_VPS.md`](deploy/HOSTINGER_VPS.md) for step-by-step commands on `72.61.192.84` / `cs-njd.duckdns.org`.

## Environment variables

Copy `.env.example` to `.env` and set production values:

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Min 32 characters — use `openssl rand -base64 32` |
| `AUTH_URL` | Recommended | Public app URL, e.g. `https://crm.example.com` |
| `BACKUP_DIR` | Optional | Defaults to `./backups` |
| `SUPER_ADMIN_EMAIL` | Bootstrap only | Set in `.env`, run `npm run db:bootstrap-admin` once |
| `SUPER_ADMIN_PASSWORD` | Bootstrap only | Min 12 chars — **never commit** |
| `SUPER_ADMIN_NAME` | Optional | Display name for super admin |

Validation runs at build time via `env.ts`. To skip locally (not for production):

```powershell
$env:SKIP_ENV_VALIDATION="true"
```

---

## Switch from `db:push` to Prisma Migrate

Use this once to baseline your **existing** database that was created with `db push`.

### 1. Ensure schema matches the database

```powershell
npx prisma db push
```

### 2. Baseline migration (already created in repo)

This repo includes:

- `prisma/migrations/20260815200000_baseline/` — full schema baseline (includes production indexes)

**Fresh database:**

```powershell
npx prisma migrate deploy
npm run db:seed
npm run db:bootstrap-admin
```

(`db:seed` creates projects only; `db:bootstrap-admin` creates the single super admin from `SUPER_ADMIN_*` in `.env`.)

**Existing database (was using `db push`):**

```powershell
npx prisma migrate resolve --applied 20260815200000_baseline
npx prisma migrate deploy
```

### 3. Create new migrations going forward

```powershell
npx prisma migrate dev --name describe_your_change
```

Review the SQL in `prisma/migrations/<timestamp>_describe_your_change/migration.sql`.

### 4. Production / staging deploys

On VPS (recommended):

```bash
cd /var/www/cs-njd && ./deploy/update.sh
```

Locally:

```powershell
npx prisma migrate deploy
npx prisma generate
npm run build:strict
npm run start
```

---

## Strict production build

```powershell
npm run build:strict
```

Runs in order:

1. `prisma generate`
2. `tsc --noEmit` (TypeScript check)
3. `next build`

---

## Post-deploy checklist

- [ ] Set strong `AUTH_SECRET` (32+ chars)
- [ ] Set `AUTH_URL` to production domain
- [ ] Set `SUPER_ADMIN_*` in `.env` and run `npm run db:bootstrap-admin` (single super admin only)
- [ ] Add staff later with `npm run db:sync-staff` or **Users** page when ready
- [ ] Confirm `.env` is **not** committed (only `.env.example`)
- [ ] Place legacy Excel in `data/legacy/` on the server (not in git)
- [ ] Run `npm run sync:excel` after uploading workbook
- [ ] Enable HTTPS and secure cookies in production
- [ ] First login: super admin only until you add staff

---

## Useful commands

```powershell
docker compose up -d
npm run db:migrate
npm run db:seed
npm run db:bootstrap-admin
npm run db:sync-staff
npm run dev
npm run build:strict
```
