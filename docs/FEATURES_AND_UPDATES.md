# NJD Post-Sales CRM — Features & Updates

**Product:** NJD Post-Sales Customer Service CRM  
**Organization:** New Jersey Developments (NJD)  
**Live URL:** https://cs-njd.duckdns.org  
**Languages:** English (LTR) · Arabic (RTL)  
**Last updated:** August 2026  

---

## Executive summary

NJD Post-Sales CRM is a bilingual web application for managing post-sales customer service across NJD’s real estate portfolio. It centralizes units, clients, cases (tickets), staff assignments, and management reporting — with enterprise security (role-based access, mandatory two-factor authentication), audit trails, and automated backups.

The system is deployed on a dedicated VPS, isolated from other NJD applications, and is actively maintained with regular feature releases.

---

## Project portfolio

The CRM supports five canonical NJD projects:

| Project | English | Arabic |
|---------|---------|--------|
| GREEN AVENUE | Green Avenue | — |
| JURA | Jura | — |
| GENESIS | Genesis | — |
| SOUL PLAZA | Soul Plaza | — |
| JAMILA NORTH COAST | Jamila North Coast | جميلة الساحل الشمالي |

---

## User roles & access

| Role | Who | Main access |
|------|-----|-------------|
| **Super Admin** | IT / system owner | Full system: imports, audit logs, backups, users, all modules |
| **Management (Executive)** | Directors / managers | Executive Command Center, cases, units, users (CS agents only) |
| **CS Agent** | Customer service staff | Dashboard, assigned units, cases, ticket updates |

Each role sees only the navigation and data appropriate to their responsibilities.

---

## Core modules

### 1. Authentication & security
- Secure login with email and password
- **Mandatory two-factor authentication (2FA)** via authenticator app (Google Authenticator, Authy, etc.)
- QR code setup + manual secret key (Copy / Start over) for reliable enrollment
- Session protection on all dashboard routes
- Forced password change flow for imported staff accounts
- Admin tools to reset 2FA when a user is locked out

### 2. Dashboard (CS agents)
- Personal overview of open work
- Quick access to assigned units and cases

### 3. Executive Command Center *(Management & Super Admin)*
Project-first command center for leadership:

**Overview tab**
- Portfolio-wide KPIs (open cases, unassigned, legal, engineering, my/team queues)
- Bar chart: open cases by project
- Donut chart: cases by category
- Agent workload cards
- **Financial analytics panel** — finishing revenue by project, package mix, and portfolio totals
- **Quick search** across all open cases (client, unit, notes, agent, status)
- Team queue & my queue with inline assign + status actions
- KPI cards and chart segments **link to the Cases page** with matching filters

**Resolved tab** *(global)*
- Portfolio-wide resolved case KPIs (total, my resolved, team resolved)
- Bar chart: resolved cases by project
- Donut chart: resolved cases by category
- Search across all resolved cases
- Team and personal resolved queues (read-only)
- “View all resolved cases” link to filtered Cases list

**Per-project tabs** (Green Avenue, Jura, Genesis, Soul Plaza, Jamila North Coast)
- **Dual count badges** on each tab: open cases (gray) and resolved cases (green), both clickable
- Project-specific open KPIs
- Category breakdown chart and project agent workload
- **Project-scoped search** filtering team and personal open queues
- **Resolved section per project:** resolved KPIs, category chart, search, team/my resolved queues
- Projects with only resolved cases (no open work) still appear in the tab bar
- Premium UI: scrollable tabs, count badges, RTL-aware layout

### 4. Cases (tickets)
- Full cases list with filters (status, category, agent, project)
- **Deep linking from Executive dashboard** — KPI cards, tab badges, and charts open Cases with pre-applied URL filters
- **CSV export** of the currently filtered case list (UTF-8 with BOM for Excel)
- Assign cases to CS agents
- Update status inline (Pending, Engineering, Legal, Resolved)
- Categories: Customer Service, Feedback History, Legal, General
- Success toasts on save / assign / delete

### 5. Units (Unit 360)
- Unit profile: client, project, handover, finishing financials
- **Client addresses** — عنوان 1 / عنوان 2 editable on Client Info tab
- **Delivery year & grace period** — السنه للتسليم, فترة سماح (editable)
- **Unit type ROOF** (رووف) plus apartment, duplex, penthouse
- **Current finishing status** — موقف الوحده الحالي من التشطيب on Finishing tab
- **CSV export** of the filtered units list from the Units page
- **Expanded finishing details** — package type, executing company, contract/dated/email dates (General · Financials · Dates sections)
- Editable finishing form with validation (Management / Super Admin)
- CS feedback timeline per unit
- Link from cases directly to unit timeline
- **WhatsApp quick contact** — one-click message to client phone with localized template
- **Print handover protocol** — A4 bilingual document (محضر استلام) opens in a dedicated print view with auto print dialog

### 6. Users
- Create and manage staff accounts
- Role assignment (Super Admin, Management, CS Agent)
- Management can create CS agents only

### 7. Data import *(Super Admin)*
- Bulk import from official Excel workbook
- Legacy customer service / feedback rows map to **tickets**, not bogus user accounts
- **Handwritten-spec column mapping** — Arabic headers from CS/Engineering sheets (addresses, delivery year, grace period, finishing status, رسوم الباب, الالوميتال, سعر المتر, etc.)
- **Finishing field mapping** — package type, executing company, contract/dated/email dates from Excel columns
- Excel sync script for ongoing updates (`npm run sync:excel`)
- Cleanup tools for bad imported data

### 8. Audit logs *(Super Admin)*
- Tracks changes to units, clients, cases (tickets), and users
- Records action type, user, timestamp, and IP address
- Searchable table view

### 9. Backups *(Super Admin)*
Full backup bundles (`.tar.gz`), not database-only dumps:

**Each backup includes**
- PostgreSQL database dump with live row counts (users, units, tickets, clients, projects, audit logs)
- Environment configuration (`.env`)
- Deploy files (PM2, Docker, nginx template, Prisma schema, app version)
- Legacy import data folder (when present)
- `manifest.json` inside the archive

**Backup page features**
- Manual “Run backup now”
- **Automatic daily backup** at 2:00 AM server time
- **Contents preview** — bullet list of what’s inside each backup
- Source badge: Manual vs Daily auto
- Download successful backups
- 14-day retention (configurable)

### 10. System *(Super Admin)*
- System version and update check placeholder

### 11. In-app notifications
- **Notification bell** in the top navbar for all authenticated roles
- Real-time-style inbox (mark read, mark all read)
- Automatic triggers when cases are assigned or move to Legal / Resolved (notifies Management & Super Admin)
- Bilingual notification messages (EN / AR)

### 12. Data lifecycle (soft delete)
- Records are **soft-deleted** instead of permanently removed (users, clients, units, cases, finishing, contract workflow)
- Deleted records are hidden from all dashboard queries automatically
- User deletion archives the email address to prevent re-use conflicts

---

## Bilingual experience

- Full **English** and **Arabic** UI via next-intl
- Automatic **RTL layout** for Arabic (navigation, tables, charts, forms)
- Localized project names, staff names, enums, and executive vocabulary
- Language switcher in the app shell

---

## Technical platform

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS, Shadcn UI |
| Backend | Next.js Server Actions, API routes |
| Database | PostgreSQL 16 (Docker on VPS) |
| ORM | Prisma 6 |
| Auth | NextAuth.js v5 + TOTP 2FA |
| Charts | Recharts (executive dashboard) |
| Hosting | Hostinger VPS, PM2, Nginx, DuckDNS |

**Production isolation:** Runs as `cs-njd-crm` on port 3001 — does not interfere with other NJD apps (e.g. eng-njd, sales-arena).

---

## Release history (recent updates)

### August 2026 — Handwritten CS/Engineering field specs
- Schema: client addresses, unit delivery year/grace period, ROOF type, finishing current status
- Bilingual labels aligned with handwritten Arabic terminology (EN / AR)
- Unit 360 forms for client info and finishing status; Excel importer header registry
- Migration: `20260823120000_add_handwritten_specs`

### August 2026 — Automation & intelligence upgrade
- **Soft deletes** across core models with Prisma middleware; deleted data excluded from KPIs and lists
- **In-app notifications** — bell icon, assignment and status-change triggers, bilingual copy
- **WhatsApp engine** — localized message templates and one-click client contact from Unit 360
- **CSV exports** on Cases and Units tables (filtered data, Excel-friendly UTF-8 BOM)
- **Executive financial analytics** — finishing revenue breakdown on Overview tab
- **Print handover protocol** — A4 bilingual محضر استلام document with auto print dialog
- Database migration: `20260823100000_automation_upgrade` (run `npx prisma migrate deploy` on production)

### August 2026 — User management rebuild
- Advanced TanStack data grid for `/users` with create/edit sheets, RBAC row actions, 2FA badges, and full i18n

### August 2026 — Per-project resolved cases (Executive)
- Each **project tab** shows open and resolved count badges (clickable → filtered Cases list)
- **Resolved section** on every project panel: KPIs, category chart, search, team/my resolved queues
- Projects with resolved-only work remain visible in the tab bar
- Bilingual labels for project-level resolved UI (EN / AR)

### August 2026 — Executive resolved tab & Cases deep linking
- Global **Resolved tab** on Executive Command Center (KPIs, charts, search, queues)
- Executive KPI cards, chart segments, and tab badges **navigate to `/cases`** with URL filters (`status`, `project`, `category`, `agent`)
- Cases page reads URL query params and applies filters on load

### August 2026 — Finishing (Unit 360) expansion
- New enums: **Finishing package** and **Executing company**
- Extended `Finishing` model: package type, executing company, contract date, dated-at, email date
- Unit 360 form: three-card layout (General · Financials · Dates) with react-hook-form + Zod validation
- Excel import maps finishing columns (including `المؤرخ في` → finishing dated-at, not sales contract)
- Database migration: `expand_finishing_details`

### August 2026 — Executive dashboard revamp
- Project-first **Executive Command Center** with Overview + per-project tabs
- KPI cards with color-coded metrics
- **Bar chart** (open cases by project) and **donut chart** (category share)
- Agent workload grids (global and per project)
- Inline team/my queue tables with assign + status actions
- Corporate chart palette and premium tab styling
- Added **Jamila North Coast** to canonical projects

### August 2026 — Executive search
- **Quick case search** on Overview tab (all projects)
- **Per-project search** on each project tab
- Filters team queue and my queue simultaneously
- Match count badges and bilingual search labels

### August 2026 — Backups & audit improvements
- Docker-aware database backup (`pg_dump` via container)
- **Full backup bundles**: database + system files in `.tar.gz`
- Daily automatic backup worker (PM2 `cs-njd-backup-cron`)
- Backup **contents preview** with bullet points per archive
- Expanded audit logging to **cases (tickets)** and **users**
- Fixed backup creation in production (system `tar` instead of bundled library)

### August 2026 — Security & UX
- Fixed stuck 2FA setup when already enabled in database
- Improved 2FA manual setup (Copy key, Start over, better error handling)
- **CRUD success toasts** across users, cases, units, backups, imports
- Delete confirmation dialogs
- Bootstrap scripts for Super Admin and Management (executive) accounts

### August 2026 — Production deployment
- VPS deployment guide (`deploy/HOSTINGER_VPS.md`)
- One-command deploy script (`deploy/update.sh`)
- PM2 auto-start on reboot
- Environment validation, error pages, migration baseline
- Live at **https://cs-njd.duckdns.org**

### June 2026 — Initial release
- Core CRM: units, clients, tickets, users, roles
- Excel legacy import (~693 units)
- RBAC, 2FA, audit logging foundation
- Bilingual EN/AR from day one

---

## Operational notes (for admins)

| Item | Detail |
|------|--------|
| **Super Admin bootstrap** | `npm run db:bootstrap-admin` (see `.env` for credentials) |
| **Executive account** | `npm run db:bootstrap-management` |
| **Deploy on VPS** | `cd /var/www/cs-njd && bash deploy/update.sh` |
| **Apply migrations (VPS)** | `npx prisma migrate deploy` (after pulling automation upgrade) |
| **Backup env (VPS)** | `BACKUP_DOCKER_CONTAINER=njd-crm-postgres-prod` |
| **Reset user 2FA** | SQL: `UPDATE "User" SET "is2FAEnabled"=false, "twoFactorSecret"=NULL WHERE email='...'` |

Full ops documentation: `deploy/HOSTINGER_VPS.md` and `deploy/VPS.md`

---

## Roadmap considerations (not yet built)

These are natural next steps, not current features:

- Email / SMS notifications on case assignment (in-app notifications are live)
- Customer-facing portal
- Mobile-optimized executive views
- PDF export from Cases list (CSV export is available; handover protocol prints to PDF via browser)
- Per-project email digests for management

---

## Contact & repository

- **GitHub:** https://github.com/davidZakaria/Cs-njd  
- **Support:** Super Admin accounts manage users, backups, and imports from within the app

---

*This document reflects the application state as of August 2026. For the latest code-level changes, see the git commit history on the `main` branch.*
