# NJD Post-Sales CRM

Enterprise Real Estate Post-Sales & Customer Service CRM with bilingual UI (Arabic RTL / English LTR), RBAC, mandatory 2FA, audit logging, bulk Excel import, and automated backups.

## Stack

- Next.js 16 (App Router), TypeScript, Tailwind, Shadcn UI
- PostgreSQL + Prisma 6
- NextAuth.js v5 + TOTP 2FA
- TanStack Table, next-intl, next-themes

## Quick start

1. **Start PostgreSQL**
   ```powershell
   docker compose up -d
   ```

2. **Configure environment**
   ```powershell
   copy .env.example .env
   ```

3. **Install & migrate**
   ```powershell
   npm install
   npx prisma db push
   npm run db:seed
   ```

4. **Import legacy workbook**
   ```powershell
   npm run import:legacy
   ```

5. **Run dev server**
   ```powershell
   npm run dev
   ```

Open [http://localhost:3000/en/login](http://localhost:3000/en/login)

## Seed credentials

| Email | Password | Role |
|---|---|---|
| admin@njd.local | ChangeMe123! | SUPER_ADMIN |
| manager@njd.local | ChangeMe123! | MANAGEMENT |

First login requires mandatory 2FA setup (scan QR with Google Authenticator / Authy).

## Roles

- **SUPER_ADMIN** — imports, audit logs, backups, system tools
- **MANAGEMENT** — user CRUD (CS agents), analytics, all units
- **CS_AGENT** — assigned units only, ticket updates

## Legacy data

The official import fixture is `data/legacy/0CS NJD 26-6-2026.xlsx` (~693 units). Re-import anytime via **Data Import** (Super Admin) or `npm run import:legacy`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development server |
| `npm run db:seed` | Seed admin users + projects |
| `npm run import:legacy` | Import Excel workbook |
| `npm run backup:cron` | Start daily 2 AM backup cron |

## Project structure

- `app/[locale]/(dashboard)/` — CRM pages
- `lib/import/` — Excel parser & sanitizers
- `prisma/schema.prisma` — database schema
- `scripts/` — backup cron & legacy import CLI
