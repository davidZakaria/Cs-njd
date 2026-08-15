# NJD CRM — System Updates Log

Last updated: **August 15, 2026**

This file summarizes features, fixes, accounts, and workflow changes applied to the NJD Post-Sales CRM during recent development sessions.

---

## Executive dashboard (new)

**Route:** `/executive` (sidebar: **Executive** / **لوحة الإدارة**)

**Who can access:** `MANAGEMENT` and `SUPER_ADMIN`

**MANAGEMENT users** are redirected here after login instead of the generic dashboard.

### Features
- **KPI cards:** open cases, unassigned, legal, engineering, my open, team open
- **Agent workload:** open-case counts per staff member
- **Team cases — assign & act:** compact table with inline assign + status update
- **My open cases:** personal queue with quick status updates
- **Link:** “Full cases view” → `/cases`

### Key files
| File | Purpose |
|------|---------|
| `app/[locale]/(dashboard)/executive/page.tsx` | Executive dashboard page |
| `lib/cases/executive-dashboard.ts` | Stats, queues, agent workload data |
| `components/executive/executive-quick-actions-table.tsx` | Inline assign + status table |
| `lib/rbac.ts` | `/executive` route + `getHomeRoute()` for MANAGEMENT |
| `middleware.ts` | Post-login redirect to `/executive` for managers |

---

## Cases page — manager workflow

**Route:** `/cases`

### Split view (MANAGEMENT role)
1. **Team cases** (shown first)
   - Filter defaults to **Open only**
   - **Assign to CS agent** column (dropdown + Assign button)
   - Assignable staff: all CS agents + Madonna + Reda Youssef
2. **My assigned cases** (collapsed by default)
   - Cases where you are the ticket or unit agent
   - Status updates only (no assign dropdown)

### Removed from Cases page
- Verbose workflow instruction cards (“requirements”, “how to meet it & close”)
- Duplicate pending-work card grid (tables are the single source of truth)

### Key files
| File | Purpose |
|------|---------|
| `app/[locale]/(dashboard)/cases/page.tsx` | Manager split + data loading |
| `lib/cases/ownership.ts` | `isCaseOwnedByUser`, `splitCasesForManager`, effective agent |
| `components/cases/cases-table.tsx` | Assign column, open filter, collapsible sections |
| `components/cases/ticket-agent-assign-form.tsx` | Reusable assign form |

---

## Staff roster & accounts

**Source of truth:** `lib/staff.ts` → `STAFF_ROSTER`

| Name | Email | Role | Notes |
|------|-------|------|-------|
| Islam Tharwat | islam.tharwat@newjerseyegypt.com | CS_AGENT | |
| Maria Emad | maria.emad@newjerseyegypt.com | CS_AGENT | |
| Mariam Nabih | mariam.nabih@newjerseyegypt.com | CS_AGENT | |
| Dina Girgis | dina.gerges@newjerseyegypt.com | CS_AGENT | |
| Madonna Hanna | madonna.hanna@newjerseyegypt.com | MANAGEMENT | Executive dashboard |
| Reda Youssef | reda.youssef@newjerseyegypt.com | MANAGEMENT | Executive dashboard (added) |

**Default staff password:** `ChangeMe123!`

**Legacy Excel names** for Eng Reda (`مهندس رضا`, `م/ رضا`, `Eng Reda`, etc.) now map to **Reda Youssef**, not Madonna.

**Test / seed accounts:**
| Email | Role |
|-------|------|
| admin@njd.local | SUPER_ADMIN |
| manager@njd.local | MANAGEMENT (no Excel assignments) |

### Sync staff to database
```powershell
npm run db:sync-staff
```

---

## CS agent experience

- **Dashboard:** unit stats + compact open-case list
- **Cases:** “My assigned cases” table (ticket or unit assigned to them)
- **Units / Cases filters:** Unassigned agent filter supported

---

## Excel import & assignments

- Customer service / feedback from Excel → **tickets**, not bogus users
- Ticket **category** field (CUSTOMER_SERVICE, FEEDBACK_HISTORY, LEGAL, GENERAL)
- Assignment sync from workbook sheets → unit + ticket `agentId`
- Madonna legacy mappings: Mostafa Mousa, Ahmed Zahed → Madonna
- Eng Reda legacy names → Reda Youssef

**Commands:**
```powershell
npm run sync:excel      # Full import + assignment sync
npm run import:legacy   # Legacy workbook import
```

---

## UI / i18n fixes

- Arabic RTL sidebar (right side)
- Bilingual labels for statuses, categories, filters (`الكل`, `غير معيّن`, etc.)
- Fixed missing `cases.awaitingResponse` translation (EN + AR)
- Fixed controlled Select warnings on Cases page
- Domain labels stabilized (`useDomainLabels` + `useMemo`)

---

## Security & auth

- NextAuth v5 + mandatory TOTP 2FA after first login
- RBAC: SUPER_ADMIN, MANAGEMENT, CS_AGENT
- Assign cases: MANAGEMENT + SUPER_ADMIN only

---

## Project structure (new / important paths)

```
app/[locale]/(dashboard)/
  executive/page.tsx          # Executive dashboard
  cases/page.tsx              # Cases (manager split)
  dashboard/page.tsx          # CS + admin dashboard (managers → redirect)
  units/...

components/
  executive/                  # Executive UI
  cases/                      # Cases table, assign form, pending cards

lib/
  staff.ts                    # Staff roster
  cases/
    executive-dashboard.ts
    ownership.ts
    pending-work.ts
    workflow.ts
  rbac.ts
  actions/crm.ts              # createTicket, assignTicketAgent, updateTicketStatus

messages/
  en.json                     # English UI strings
  ar.json                     # Arabic UI strings

prisma/
  seed.ts                     # Seed admin + staff
scripts/
  sync-staff-users.ts         # Sync STAFF_ROSTER → database
  sync-from-excel.ts
```

---

## Local development

```powershell
docker compose up -d          # Postgres (port 5433)
npm install
npm run db:push
npm run db:seed
npm run db:sync-staff
npm run sync:excel            # Optional: load Excel data
npm run dev                   # http://localhost:3000
```

**Login URLs:**
- English: http://localhost:3000/en/login
- Arabic: http://localhost:3000/ar/login

---

## Quick reference — who sees what

| Feature | CS_AGENT | MANAGEMENT | SUPER_ADMIN |
|---------|----------|------------|-------------|
| Executive dashboard | — | ✓ (home) | ✓ |
| Generic dashboard | ✓ (home) | redirect → executive | ✓ |
| Assign cases to team | — | ✓ | ✓ |
| My vs team case split | — | ✓ | all cases (single table) |
| Users management | — | ✓ | ✓ |
| Imports / audit / backups | — | — | ✓ |

---

## How to keep this file updated

After significant changes, append a dated section below or re-run documentation from git:

```powershell
git diff --stat
git log -10 --oneline
```

---

*Generated for the NJD Post-Sales CRM project at `E:\My Projects\Customer Service  njd`*
