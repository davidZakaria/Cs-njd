# NJD Post-Sales CRM — Features & Updates

**Product:** NJD Post-Sales Customer Service CRM  
**Organization:** New Jersey Developments (NJD)  
**Live URL:** https://njd-crm.com · https://www.njd-crm.com  
**Legacy URL:** https://cs-njd.duckdns.org (still works)  
**Languages:** English (LTR) · Arabic (RTL)  
**Last updated:** 6 September 2026  

---

## Executive summary

NJD Post-Sales CRM is a bilingual web application for managing post-sales customer service across NJD’s real estate portfolio. It centralizes units, clients, cases (tickets), staff assignments, and management reporting — with enterprise security (role-based access, mandatory two-factor authentication), audit trails, and automated backups.

The system is deployed on a dedicated VPS (`72.61.192.84`), isolated from other NJD applications, with a custom GoDaddy domain and SSL, and is actively maintained with regular feature releases.

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
| **Super Admin** | IT / system owner | Full system: imports, audit logs, backups, users, system monitoring, security, maintenance mode, all modules |
| **Management (Executive)** | Directors / managers | Executive Command Center, cases, units, users (CS agents & site engineers) |
| **CS Agent** | Customer service staff | Dashboard, assigned units & cases, **global unit lookup** (Cmd+K by phone/name/code), client contact on Unit 360, **Log Call on any unit** answered on the phone, ticket updates on assigned units |
| **Site Engineer** | On-site finishing team (shared login) | **Engineering Portal** only — mobile task queue, finishing checklist, site notes; **no 2FA**, no client PII or financials |

Each role sees only the navigation and data appropriate to their responsibilities.

---

## Core modules

### 1. Authentication & security
- Secure login with email and password
- **Mandatory two-factor authentication (2FA)** via authenticator app (Google Authenticator, Authy, etc.) — **required for Super Admin, Management, and CS Agent; not required for Site Engineer** (password-only shared on-site account)
- QR code setup + manual secret key (Copy / Start over) for reliable enrollment
- **Session lifetime controls** — sessions expire after **8 hours** (configurable); users must sign in again when the session ends
- **Browser-close logout** — session cookie is not persisted across browser restarts (default); reopening the browser requires login
- **Session guard** — expired or revoked sessions redirect to login with a clear message; session rechecked when returning to a tab
- Session protection on all dashboard routes
- Forced password change flow for imported staff accounts
- Admin tools to reset 2FA when a user is locked out

### 2. Dashboard (CS agents)
- Personal overview of open work (assigned units and cases)
- **Pending work queue** grouped by project with **client phone numbers** visible for call handling
- Stats scoped to the agent’s assigned portfolio

### 2b. Global spotlight search *(Super Admin, Management, CS Agent)*
- **Cmd+K / Ctrl+K** quick search from anywhere in the app
- Search by **unit code**, **client name**, or **phone number**
- **CS agents search the full portfolio** (all units) — essential for inbound calls even when the unit is assigned to another agent
- Results link directly to Unit 360 profile

### 3. Executive Command Center *(Management & Super Admin)*
Project-first command center for leadership:

**Overview tab**
- **Key metrics row** — single consolidated KPI strip (no duplicate team/my counts):
  - Portfolio: total units, delivered, overdue deliveries, handover at-risk, missing signed protocol, outstanding fees
  - Operations: open work, unassigned, legal cases, engineering, pending with party, follow-ups due
- **Handover pipeline chart** — pending → in progress → delivered → at-risk / legal
- **Finishing progress chart** — units by current engineering finishing phase
- **Signed protocol compliance chart** — uploaded vs missing among resolved units
- Bar chart: open cases by project
- Donut chart: cases by category (resolved tab uses “Resolved cases” center label)
- **Pending parties chart** — bottleneck breakdown (Client, Engineering, Legal, Finance, etc.)
- **Financial analytics panel** — finishing revenue by project and portfolio totals *(enabled)*
- **Quick search** across all open cases (client, unit, notes, agent, status)
- Agent workload cards
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
- Full cases list with filters (status, category, agent, project, **follow-up due**, **pending party**)
- **Deep linking from Executive dashboard** — KPI cards, tab badges, and charts open Cases with pre-applied URL filters
- **CSV export** of the currently filtered case list *(Management & Super Admin only; hidden for CS agents)*
- Assign cases to CS agents
- Update status inline (Pending, Engineering, Legal, Resolved)
- **Resolution gates** — cannot resolve while finishing incomplete, fees unpaid, papers missing, pending with another party, **active legal block**, or **custom modifications pending** *(Management override available)*
- **Legal block banner** on Unit 360 when unit is under lawsuit/dispute — WhatsApp and handover actions disabled for CS
- **Pending party** workflow field (Client, Engineering, Legal, Finance, Management, Logistics, **Customer Service** for CS handback)
- **Next follow-up date** with “Due today” filter
- Categories: Customer Service, Feedback History, Legal, General
- Success toasts on save / assign / delete

### 5. Units (Unit 360)
- Unit profile: client, project, handover, finishing financials
- **Management / Super Admin CRUD** — edit client info (name, phones, email, national ID, addresses), handover status, delivery dates, and legal/handover checklist fields inline on Unit 360
- **CS inbound-call access** — any CS agent can open **any unit profile** via spotlight search to view client contact; list/cases remain scoped to assigned work
- **Log Call** — CS agents can log a call on **any unit** they handled on the phone (not restricted to assigned units or legal-block state)
- **Client phones & email visible** to CS agents (WhatsApp one-click contact)
- **Client addresses** — عنوان 1 / عنوان 2 editable on Client Info tab
- **Delivery year & grace period** — السنه للتسليم, فترة سماح (editable)
- **Unit type ROOF** (رووف) plus apartment, duplex, penthouse
- **Engineering finishing phases** — 9-step checklist (plumbing foundation → final paint) with dates; drives resolution gates and executive finishing chart
- **Edge-case workflow fields** — legal block, power of attorney / DHL received, inspection date, custom modifications + completion flag (Legal & Finishing tabs)
- **Current finishing status** — موقف الوحده الحالي من التشطيب on Finishing tab
- **CSV export** of the filtered units list *(Management & Super Admin only; hidden for CS agents)*
- **Expanded finishing details** — package type, executing company, contract/dated/email dates (General · Financials · Dates sections)
- Editable finishing form with validation (Management / Super Admin)
- **CS feedback timeline** per unit with **view/edit modes**; Management can add/edit/delete timeline entries
- Link from cases directly to unit timeline
- **WhatsApp quick contact** — one-click message to client phone with localized template
- **Print handover protocol** — official bilingual **محضر استلام** from Word templates:
  - **Green Avenue** and **JURA** variants
  - With/without insurance, single/dual signature options
  - Arabic left · English right; auto-filled client, unit, contract dates
  - **NJD logo** centered in print header; template picker on Unit 360
- **Signed protocol upload** — after ≥1 resolved case, upload client-signed PDF/scan (Legal tab + Timeline when resolved):
  - Stored on server under `uploads/signed-protocols/`
  - Auto-sets `hasSignedProtocol` and `papersReceived`
  - CS agents: upload on **assigned units only**; Management: any unit

### 5b. Engineering Portal *(Site Engineer)*
Mobile-first portal for on-site finishing updates — isolated from the main CRM (no Unit 360, Cases, or Executive access).

- **Task queue** (`/engineering`) — card list of all units with open tickets where **Pending with = Engineering** (one shared login sees the full site queue)
- **Task view** (`/engineering/units/[id]`) — unit code, project, **9-step finishing checklist**, custom modifications + completion flag, **site / execution notes**
- **Return to Customer Service** — saves progress, sets ticket **Pending with → Customer Service**, adds timeline note (`🏗️ [Site Update]`), notifies the unit’s CS agent
- **Data isolation** — no client phones, email, addresses, or financial fields; **Cmd+K spotlight disabled**
- **Password-only login** — no 2FA enrollment for `ENGINEER` role (suited for shared on-site mobile device)
- **Single shared account** — only one Site Engineer user may exist in the system
- Bilingual UI (EN / AR)

### 6. Users
- Create and manage staff accounts
- Role assignment (Super Admin, Management, CS Agent, **Site Engineer** — max **one** shared engineer account)
- Management can create CS agents and the single site engineer account

### 7. Data import *(Super Admin)*
- Bulk import from official Excel workbooks
- **Multi-workbook sync** — `npm run sync:excel:all` ingests three files:
  - `docs/updated final.xlsx` (NJD 2026 master + FINAL finishing)
  - `docs/Greenavenue & Genesis Delivery .xlsx` (delivery / legal / engineering columns)
  - `docs/Jamila Clients Data.xlsx` (Jamila North Coast units — **188 units**; cases created only where **NOTE** column has text)
- **Project name normalization** — e.g. “Jamila” → `JAMILA NORTH COAST`
- Legacy customer service / feedback rows map to **tickets**, not bogus user accounts
- **Handwritten-spec column mapping** — Arabic headers from CS/Engineering sheets (addresses, delivery year, grace period, finishing status, رسوم الباب, الالوميتال, سعر المتر, etc.)
- **Finishing field mapping** — package type, executing company, contract/dated/email dates from Excel columns
- **Edge-case text parsing** — lawsuit, POA/DHL, custom mod keywords synced from legacy Excel notes into workflow fields
- Excel sync script for ongoing updates (`npm run sync:excel` / `sync:excel:all`)
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

### 10. System administration *(Super Admin)*

Collapsible sidebar groups organize super-admin tools:

**Users & Security**
- User management (same advanced grid as Management, plus full role control)
- **Security & Sessions** — login history table (email, IP, browser, success/fail) and active-session control with **Kill sessions** (increments session version; revoked users are signed out on next request)

**Data Hub**
- Imports, backups, audit logs (unchanged modules, grouped for clarity)

**Monitoring**
- **System health dashboard** — live CPU load, memory (system + process RSS), disk usage, server uptime; color-coded thresholds (green / amber / red)

**System**
- **General settings** — **maintenance mode** toggle stored in `SystemSetting`; when enabled, CS agents and Management are redirected to a maintenance screen; Super Admin bypasses
- Legacy system version / update-check placeholder page

**Session security (all roles)**
- Login attempts recorded (success and failure) with IP and user agent
- Per-user `sessionVersion` on JWT — admin session kill invalidates existing tokens immediately
- **Configurable session policy** via `.env`:
  - `AUTH_SESSION_MAX_AGE_SECONDS` (default `28800` = 8 hours)
  - `AUTH_SESSION_UPDATE_AGE_SECONDS` (default `1800` = 30 min activity refresh)
  - `AUTH_SESSION_BROWSER_ONLY` (default `true` — re-login after browser restart)

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
- **RTL table alignment fix** — fixed column headers/cells in Arabic data grids (Units, Cases, Users, security tables)
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
| Hosting | Hostinger VPS (`72.61.192.84`), PM2, Nginx, Let's Encrypt SSL |
| Domain | **njd-crm.com** (GoDaddy DNS) · legacy DuckDNS |

**Production isolation:** Runs as `cs-njd-crm` on port 3001 — does not interfere with other NJD apps (e.g. eng-njd, sales-arena).

---

## Release history (recent updates)

### September 2026 — Session security & custom domain
- **Session expiry** — 8-hour max session lifetime; idle refresh every 30 minutes while active
- **Re-login after browser close** — session cookie not persisted across browser restarts (default)
- **Session guard** — client-side check on dashboard; redirects to login with `?reason=session_expired` when session ends or is revoked
- **Custom domain live** — `https://njd-crm.com` and `https://www.njd-crm.com` with Let's Encrypt SSL
- **GoDaddy DNS guide** — `deploy/GODADDY-DNS.md` (A record → VPS, forwarding/parking troubleshooting)
- **Domain setup script** — `deploy/setup-domain.sh` (certbot + `AUTH_URL` + rebuild)
- Nginx config: `deploy/nginx-njd-crm.conf.example`

### September 2026 — Excel multi-workbook import & Jamila North Coast
- **`npm run sync:excel:all`** — sync master + Green Avenue/Genesis delivery + Jamila workbooks in one run
- **Jamila North Coast** — 188 units imported from `Jamila Clients Data.xlsx`; cases created only for rows with **NOTE** filled (e.g. delivery extension notes)
- **Project alias mapping** — `lib/import/project-names.ts` normalizes sheet project names to canonical DB names
- **Delivery Data sheet parser** — engineering / legal / CS columns from Green Avenue & Genesis workbook
- Production seed result (Sep 2026): ~232 units created, ~1756 updated, 0 errors

### September 2026 — Airtight edge-case gates & Management CRUD
- **Schema:** `isLegallyBlocked`, `powerOfAttorneyReceived`, `inspectionDate` on contract workflow; `customModifications`, `modificationsCompleted` on finishing
- **Gates:** `active_lawsuit`, `modifications_pending` block case resolution (Management override retained)
- **UI:** legal block banner, disabled WhatsApp when blocked, handover/finishing edge-case fields, bilingual labels
- **Import:** `lib/import/edge-case-sync.ts` parses legacy Arabic/English keywords from Excel notes
- **Management Unit 360 CRUD** — edit client profile + legal/handover checklist (Super Admin + Management)
- Migration: `20260902130000_airtight_edge_cases`

### September 2026 — Engineering Portal (Phase 4)
- **`ENGINEER` role** — password-only login (no 2FA); route lock to `/engineering` only
- **Engineering Portal** — mobile task queue, finishing checklist, site notes, sticky **Return to CS** handoff
- **CS ↔ Engineering workflow** — `pendingParty` **CUSTOMER_SERVICE** for handback; `engineeringNotes` on tickets
- **Single shared site engineer account** — one `ENGINEER` user; no per-unit engineer assignment UI
- **Schema:** `assignedEngineerId` on Unit (reserved), `engineeringNotes` on Ticket; migration `20260906120000_add_engineer_role`
- Management can create **CS Agent** or **Site Engineer** users

### September 2026 — CS Log Call & preview account
- **Log Call** — CS agents can log calls on **any unit** they answered (removed assignment and legal-block restrictions on quick action)
- **CS preview login** — `davidsamii3@gmail.com` views Islam Tharwat’s assigned portfolio (`npm run db:bootstrap-cs-preview`)

### September 2026 — CS call-center access
- **Global spotlight search** — CS agents search **all units** by phone, name, or unit code (not limited to assigned portfolio)
- **Unit 360 read access** — CS can open any unit profile from search to view client contact for inbound calls
- **Phone redaction removed** — client phones, email, and WhatsApp visible on Unit 360 and dashboard pending-work queue
- **Export restricted** — CSV/Excel export hidden on Cases and Units for CS agents

### September 2026 — Executive portfolio upgrade
- **Portfolio analytics** — handover pipeline, finishing phases, signed-protocol compliance, delivery overdue, follow-ups due
- **Consolidated key metrics** — single KPI row; removed duplicate “Team units” / “My units” counts on overview
- **Financial analytics panel** re-enabled on executive overview
- **Pending parties bottleneck chart** on overview
- Bilingual labels: “Legal cases” vs “Handover at-risk” to avoid confusion

### September 2026 — Handover print & signed documents
- **Official bilingual handover templates** — 6 variants (Green Avenue / JURA; insurance; dual signature) from legal Word docs
- **NJD logo** on print header (single centered logo)
- **Signed protocol upload** after case resolution — PDF/image storage, download API, Legal + Timeline UI
- Migration: `20260902120000_signed_protocol_upload`
- `UPLOADS_DIR` env (default `./uploads`) for on-disk document storage

### September 2026 — Ops excellence workflow
- **9-step engineering finishing phases** (replaces legacy phase enum); multi-select checklist on Unit 360
- **Resolution gates** — block resolve until finishing, fees, papers, and pending-party rules pass
- **Management override** checkbox for gated resolves
- **Pending party** + **next follow-up date** on tickets; Due Today filter on Cases
- **Timeline CRUD** for Management on Unit 360 (cleaner view/edit UI)
- Migration: `20260902100000_ops_excellence_workflow`, `20260823230000_workflow_enforcement_gates`, `20260823220000_finishing_phase_tracker`

### August 2026 — Super Admin expansion
- **Schema:** `LoginHistory`, `SystemSetting`, user `lastLoginAt` + `sessionVersion`; migration `20260823140000_super_admin_expansion`
- **Sidebar:** collapsible SUPER_ADMIN nav groups (Users & Security, Data Hub, Monitoring, System)
- **System monitoring** (`/system/monitoring`) — CPU, memory, disk, uptime KPIs with usage thresholds
- **Security & sessions** (`/system/security`) — login history + kill sessions for any user
- **Maintenance mode** (`/system/settings`) — DB-backed toggle; middleware redirects CS Agent / Management to `/maintenance`; Super Admin bypass
- **Auth hardening** — login attempt logging, JWT session-version validation, revoked-session middleware handling
- **RTL table fixes** for Arabic column alignment across major data grids

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
- Live at **https://njd-crm.com** (Sep 2026) and **https://cs-njd.duckdns.org**

### June 2026 — Initial release
- Core CRM: units, clients, tickets, users, roles
- Excel legacy import (~693 units)
- RBAC, 2FA, audit logging foundation
- Bilingual EN/AR from day one

---

## Operational notes (for admins)

| Item | Detail |
|------|--------|
| **Primary URL** | https://njd-crm.com |
| **Super Admin bootstrap** | `npm run db:bootstrap-admin` (see `.env` for credentials) |
| **Executive account** | `npm run db:bootstrap-management` |
| **CS preview account** | `npm run db:bootstrap-cs-preview` at `/var/www/cs-njd` (maps to Islam Tharwat portfolio) |
| **Deploy on VPS** | `cd /var/www/cs-njd && bash deploy/update.sh` |
| **Custom domain + SSL** | `bash deploy/setup-domain.sh njd-crm.com` (after DNS A record → `72.61.192.84`) |
| **GoDaddy DNS help** | `deploy/GODADDY-DNS.md` — remove forwarding/parking, set A record, optional `app.` subdomain |
| **Excel full sync** | `npm run sync:excel:all` (three workbooks under `docs/`) |
| **Session env (VPS)** | `AUTH_SESSION_MAX_AGE_SECONDS`, `AUTH_SESSION_BROWSER_ONLY` — see `.env.example` |
| **Apply migrations (VPS)** | `npx prisma migrate deploy` (includes edge-case and ops workflow migrations if not yet applied) |
| **Signed protocol uploads** | Files stored under `{UPLOADS_DIR}/signed-protocols/` (default `./uploads`); ensure directory exists on VPS |
| **Maintenance mode** | Super Admin → System → General Settings; blocks CS Agent & Management only |
| **Kill user sessions** | Super Admin → Users & Security → Security & Sessions → Active sessions tab |
| **Backup env (VPS)** | `BACKUP_DOCKER_CONTAINER=njd-crm-postgres-prod` |
| **Reset user 2FA** | SQL: `UPDATE "User" SET "is2FAEnabled"=false, "twoFactorSecret"=NULL WHERE email='...'` |

Full ops documentation: `deploy/HOSTINGER_VPS.md` and `deploy/VPS.md`

---

## Roadmap considerations (not yet built)

These are natural next steps, not current features:

- Email / SMS notifications on case assignment (in-app notifications are live)
- Customer-facing portal
- Mobile-optimized executive views
- Per-project email digests for management
- Scheduled maintenance windows with advance user notice (maintenance mode toggle is live)
- Filter Units list by “missing signed protocol” from executive KPI link

---

## Contact & repository

- **GitHub:** https://github.com/davidZakaria/Cs-njd  
- **Support:** Super Admin accounts manage users, backups, and imports from within the app

---

*This document reflects the application state as of 6 September 2026. For the latest code-level changes, see the git commit history on the `main` branch.*
