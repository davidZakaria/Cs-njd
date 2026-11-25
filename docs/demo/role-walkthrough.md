# Department demo walkthrough (Legal, Finance, Operations)

Last validated against production-style build with `scripts/seed-demo-readiness.ts`.

**Demo logins** (password `TestPassword1234!`, TOTP secret `JBSWY3DPEHPK3PXP` when prompted):

| Department   | Email                     | Home route        |
|-------------|---------------------------|-------------------|
| Legal       | `demo-legal@test.local`   | `/legal`          |
| Finance     | `demo-finance@test.local` | `/finance`        |
| Operations  | `demo-ops@test.local`     | `/operations`     |

Related roles in the `Role` enum that are **not** part of tomorrow’s demo: `SUPER_ADMIN`, `MANAGEMENT`, `CS_AGENT`, `COMMUNITY_MANAGEMENT`, `ENGINEER`.

---

## Legal (`LEGAL`)

### What this account is for

Legal staff approve contract-related unit requests, clear archive-check **gaps** assigned to Legal, and work **Legal handover** stages on the unit cycle. They have read-only unit profiles (no CS editing) and use the internal **Requests** workspace—not Operations’ archive inbox.

### Sidebar (demo order)

1. **Legal home** (`/legal`) — awaiting approvals, archive gaps, overdue summary, my stage tasks.
2. **Requests** (`/requests`) — full list with filters; open a row to approve/reject at Legal’s step.
3. **Overdue tasks** (`/legal/overdue-tasks`) — personal + department pool for `LEGAL_HANDOVER` stages.

### Key flows to show (5–8)

1. **Legal home → Awaiting requests** — contract issue (overdue) and grace period annex pending Legal approval.
2. **Open request → Approve** — `CONTRACT_ISSUE_OR_AMENDMENT` (path: Legal → Management) or `DOCUMENT_CORRECTION` (Legal only).
3. **Archive gap queue on home** — after Operations submits an archive check with missing items, claim/complete a Legal-owned gap from home or request detail.
4. **Overdue tasks** — claim an overdue `LEGAL_HANDOVER` stage; show personal vs department pool.
5. **Requests filters** — `view=awaiting`, overdue chip; confirm types show translated labels (not raw enums).
6. **Arabic + RTL** — repeat home and one request detail; sidebar on the right, Arabic type labels.
7. **Unit profile (deep link)** — from a request, open unit read-only; no edit controls for identity or handover checklist.

### Request types Legal approves (approval path)

| Type | Steps |
|------|--------|
| `CONTRACT_ISSUE_OR_AMENDMENT` | LEGAL → MANAGEMENT |
| `GRACE_PERIOD_ANNEX` | LEGAL → MANAGEMENT |
| `DOCUMENT_CORRECTION` | LEGAL |

### Notifications (set expectations)

- No **Activity notifications** page (`/notifications` is CS/Management only).
- Header bell shows **general** items only; overdue work appears on **home queues**, not the bell.
- Escalation cron (not shown live) can write `REQUESTS_AND_FILES` / `OVERDUE_TASKS` activity rows for assigned users.

### Cannot do (intentional)

- Create requests, cases, or call logs (CS/Management).
- `/units` list, `/cases`, `/dashboard`, `/operations` tracker.
- Edit legal handover checklist on unit (except viewing); toggle **papers received** (Operations only).
- Fulfill archive file scans (Operations inbox).
- User admin, imports, backups, executive analytics.

---

## Finance (`FINANCE`)

### What this account is for

Finance approves payment and finishing-related requests, resolves archive gaps owned by Finance, and works **Finance** unit-cycle stages.

### Sidebar

1. **Finance home** (`/finance`)
2. **Requests** (`/requests`)
3. **Overdue tasks** (`/finance/overdue-tasks`)

### Key flows to show

1. **Finance home** — awaiting refund (overdue), payment plan change, finishing price change.
2. **Approve / reject** on `PAYMENT_PLAN_CHANGE` (Finance only) or `REFUND` (Finance → Management).
3. **Archive gap tasks** — Finance-owned gaps from archive checks.
4. **Overdue Finance stages** — personal assigned task + unclaimed pool on third demo unit.
5. **Requests → overdue filter** — finance types with readable labels EN/AR.
6. **Arabic home** — finance title/subtitle and RTL table alignment on requests.

### Request types Finance approves

| Type | Steps |
|------|--------|
| `FINISHING_PRICE_CHANGE_OR_DISCOUNT` | FINANCE → MANAGEMENT |
| `PAYMENT_PLAN_CHANGE` | FINANCE |
| `REFUND` | FINANCE → MANAGEMENT |

### Cannot do

Same structural limits as Legal: no operations tracker, no request creation, no cases/units list, no executive dashboard, no editing finishing financials on the unit profile.

---

## Operations (`OPERATIONS`)

### What this account is for

Operations owns **contract archive progress** across projects, performs **archive checks** (physical papers), and fulfills **archive file requests** (scanned copies). They mark **papers received** on units but do not use the Legal/Finance request inbox.

### Sidebar

1. **Operations** (`/operations`) — project summary, archive check queue, units table.
2. **Operations requests** (`/operations/requests`) — archive file request inbox (badge = unread).

### Key flows to show

1. **Progress tracker** — filter by project; open unit checklist → link to unit Legal tab.
2. **Archive check queue** — open check workspace; mark item missing/found; upload scan; **Submit** (creates Legal/Finance gaps—mention follow-up on their homes).
3. **Archive file inbox** — urgent file request; upload or mark not found.
4. **Unit profile** — toggle **papers received** only; upload portfolio docs when slot empty.
5. **Arabic operations home** — RTL summary bar and table.
6. **Mobile width** — collapse sidebar; queue still usable.

### Request types Operations approves

| Type | Steps |
|------|--------|
| `ARCHIVE_CHECK` | OPERATIONS |
| `ARCHIVE_FILE_REQUEST` | OPERATIONS |

### Cannot do

- `/requests` dashboard (redirect/guard).
- Create archive checks (CS creates; Operations executes).
- Resolve archive **gaps** (Legal/Finance).
- Cases, notifications page, user admin, legal/financial request approvals on standard request types.

---

## Cross-department narrative (60 seconds)

CS submits contract + archive work → **Operations** verifies papers and files → gaps land on **Legal/Finance** homes → **Legal/Finance** approve financial/contract requests on `/requests` → Management steps (not shown tomorrow) close multi-step paths.

---

## Demo environment

```bash
docker compose up -d postgres
cp .env.example .env   # set AUTH_SECRET
npx prisma db push     # or migrate deploy on upgraded DBs
npx tsx scripts/seed-demo-readiness.ts
npm run build && npm run start
```

Production is not touched; all data is fake and marked `demo-readiness` in request descriptions.