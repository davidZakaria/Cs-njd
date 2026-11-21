# NJD-CRM Workflow & System Audit Report

**Date:** November 2026  
**Auditor:** Cursor Cloud Agent  
**Scope:** Full code-level audit of njd-crm (CS-njd repository)  
**Method:** Static code analysis of all modules, workflows, permissions, and state machines

---

## Executive Summary

This audit provides a comprehensive analysis of the NJD Post-Sales CRM system for J Communities. The CRM manages after-sales processes for five real estate projects: Green Avenue, Jamila North Coast, Soul Plaza, Genesis, and Jura. The system serves CS agents, Legal, Finance, Operations, and Management/Supervisors.

### Top 10 Critical Findings

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 1 | **Approved requests don't auto-update unit data** — when a Contract Amendment or Grace Period Annex is approved, the unit's `contractWorkflow` fields are NOT automatically updated. Manual data entry required. | P0 | `lib/actions/unit-requests.ts:approveUnitRequestStepAction` |
| 2 | **No activity timeline on Unit 360** — there's no unified chronological view of all actions on a unit (calls, requests, status changes, documents). Timeline only shows tickets. | P1 | `app/[locale]/(dashboard)/units/[id]/page.tsx` |
| 3 | **Hard-coded approval paths** — all request workflows have fixed approval chains. No configuration UI to modify who approves what. | P1 | `lib/requests/approval-paths.ts` |
| 4 | **No SLA tracking or escalation rules configuration** — deadlines are hard-coded per request type (7 days default). No UI to configure SLAs by request type or priority. | P1 | `lib/requests/workflow-helpers.ts:DEFAULT_REQUEST_DUE_DAYS` |
| 5 | **Missing bulk actions** — no bulk status update, bulk assignment, or bulk approval capabilities on any list view. | P2 | All list components |
| 6 | **No saved filters or list views** — users cannot save filter combinations for quick access. | P2 | `lib/cases/cases-filter-url.ts` |
| 7 | **No inline editing** — all edits require opening modals or detail pages; no click-to-edit on tables. | P2 | All table components |
| 8 | **No real-time updates** — pages require manual refresh to see changes made by other users. | P2 | All pages |
| 9 | **Limited search** — Cmd+K spotlight only searches units by code/name/phone. No global search across cases, requests, or documents. | P2 | `lib/actions/spotlight-search.ts` |
| 10 | **No configurable fields or picklists** — all dropdown values (handover status, finishing phases, etc.) are enums requiring code changes. | P2 | `prisma/schema.prisma` - all enum types |

### Top 10 Salesforce Gaps Worth Building

| # | Feature | Business Value | Effort |
|---|---------|---------------|--------|
| 1 | **Automatic data propagation on approval** — approved requests update unit fields | Critical — eliminates double entry, ensures accuracy | Medium |
| 2 | **Unified activity timeline** — all interactions in chronological order | High — single source of truth per unit/client | Medium |
| 3 | **Configurable SLAs with escalation rules** — set deadlines by request type, auto-escalate | High — ensures timely processing | Large |
| 4 | **Saved list views & filters** — personal and shared filter presets | High — massive productivity gain | Medium |
| 5 | **Bulk actions** — select multiple, apply action | High — operational efficiency | Medium |
| 6 | **Inline editing on tables** — click cell to edit | Medium — faster data entry | Medium |
| 7 | **Real-time updates (WebSocket/polling)** — live refresh without manual reload | Medium — collaborative efficiency | Large |
| 8 | **Reports builder** — custom reports without code changes | Medium — analytics flexibility | Large |
| 9 | **Email/SMS/WhatsApp integration** — send from CRM, track delivery | Medium — communication audit trail | Large |
| 10 | **Field history tracking** — who changed what when on any field | Medium — compliance and debugging | Medium |

---

## Part 1: Module & Workflow Mapping

### 1.1 Modules Overview

```
app/[locale]/(dashboard)/
├── dashboard/           # CS Agent home
├── executive/           # Management Command Center
│   ├── document-templates/  # Official document templates
│   ├── overdue-tasks/      # Overdue task monitoring
│   └── project-settings/   # Unit cycle settings per project
├── operations/          # Operations department
│   ├── archive-checks/     # Archive check review
│   ├── requests/           # Archive file requests
│   └── units/[id]/         # Operations unit view
├── requests/            # Request inbox (all roles)
├── cases/               # Ticket/case management
├── units/               # Unit database & Unit 360
├── users/               # User management
│   └── 2fa-requests/       # 2FA reset requests
├── legal/               # Legal department home
│   └── overdue-tasks/
├── finance/             # Finance department home  
│   └── overdue-tasks/
├── engineering/         # Site Engineer portal
│   └── units/[id]/         # Engineering unit checklist
├── notifications/       # Notification inbox
├── imports/             # Excel import (Super Admin)
├── audit-logs/          # Audit log viewer (Super Admin)
├── backups/             # Backup management (Super Admin)
└── system/              # System administration
    ├── general-settings/   # Maintenance mode
    ├── monitoring/         # System health
    ├── notifications-log/  # Notification audit
    ├── security/           # Login history, session management
    └── settings/           # Legacy settings page
```

### 1.2 User Roles & Permissions Matrix

| Feature | SUPER_ADMIN | MANAGEMENT | CS_AGENT | OPERATIONS | LEGAL | FINANCE | ENGINEER | COMMUNITY_MGMT |
|---------|-------------|------------|----------|------------|-------|---------|----------|----------------|
| Executive Dashboard | ✓ | ✓ | — | — | — | — | — | — |
| Operations Dashboard | ✓ | ✓ | ✓ | ✓ | — | — | — | — |
| Requests Inbox | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | ✓ |
| Cases List | ✓ | ✓ | ✓ | — | — | — | — | ✓ |
| Units List | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| Unit 360 Detail | ✓ | ✓ | ✓ | ✓ (limited) | ✓ (limited) | ✓ (limited) | — | ✓ |
| Create Cases | ✓ | ✓ | ✓ (assigned) | — | — | — | — | — |
| Assign Cases | ✓ | ✓ | — | — | — | — | — | — |
| Create Requests | ✓ | ✓ | ✓ | — | — | — | — | ✓ |
| Approve Requests | ✓ | ✓ | ✓ (CS types) | ✓ (archive) | ✓ | ✓ | — | — |
| Edit Unit Profile | ✓ | ✓ | ✓ (partial) | — | — | — | — | ✓ (Jamila) |
| User Management | ✓ | ✓ (CS/Eng/Ops/Legal/Finance) | — | — | — | — | — | — |
| System Admin | ✓ | — | — | — | — | — | — | — |
| Engineering Portal | ✓ | — | — | — | — | — | ✓ | — |
| Imports/Backups | ✓ | — | — | — | — | — | — | — |

**Reference:** `lib/rbac.ts`, `lib/auth/role-permissions.ts`

### 1.3 Request Types & Approval Workflows

Each request type has a defined approval path. The state machine is:

```
DRAFT → PENDING → (approval steps) → APPROVED/REJECTED/CANCELLED
```

| Request Type | Approval Path | Triggers On Approval |
|--------------|---------------|----------------------|
| CONTRACT_ISSUE_OR_AMENDMENT | LEGAL → MANAGEMENT | ⚠️ **None** (should update contract workflow) |
| GRACE_PERIOD_ANNEX | LEGAL → MANAGEMENT | ⚠️ **None** (should update extension fields) |
| UNIT_SWAP | MANAGEMENT | Executes `executeUnitSwapTransaction` ✓ |
| FINISHING_PRICE_CHANGE_OR_DISCOUNT | FINANCE → MANAGEMENT | ⚠️ **None** |
| PAYMENT_PLAN_CHANGE | FINANCE | ⚠️ **None** |
| REFUND | FINANCE → MANAGEMENT | ⚠️ **None** |
| SITE_VISIT | CS_AGENT | Records `SITE_VISIT_COMPLETION` engineering approval ✓ |
| SNAG_OR_DEFECT | CS_AGENT | Records `SNAG_DEFECT_CLOSURE` engineering approval ✓ |
| HANDOVER_APPOINTMENT | CS_AGENT | ⚠️ **None** |
| DOCUMENT_CORRECTION | LEGAL | ⚠️ **None** |
| ARCHIVE_CHECK | OPERATIONS | Auto-completes when all items checked ✓ |
| ARCHIVE_FILE_REQUEST | OPERATIONS | ⚠️ **None** |

**Critical Gap:** Approval of CONTRACT_ISSUE_OR_AMENDMENT, GRACE_PERIOD_ANNEX, etc. do NOT automatically update the corresponding unit fields. This requires manual double-entry.

**Reference:** `lib/requests/approval-paths.ts`, `lib/actions/unit-requests.ts`

### 1.4 Ticket (Case) State Machine

```
States: PENDING, ENGINEERING, LEGAL, RESOLVED

Transitions:
- PENDING → ENGINEERING: Sets pendingParty to ENGINEERING
- PENDING → LEGAL: Triggers notifyLegalEscalation
- * → RESOLVED: Requires all resolution gates to pass (or Management override)
- RESOLVED → PENDING/ENGINEERING/LEGAL: Reopen (Management only)

Resolution Gates (must all pass):
1. party_not_none: pendingParty must be NONE
2. finishing_not_done: Finishing phases must be complete (if fully-finished package)
3. fees_unpaid: Fees must be paid if door/aluminum fees > 0
4. missing_papers: Protocol signed, papers received, extension signed (if applicable)
5. signed_contract_missing: signedContractFile must exist
6. active_lawsuit: isLegallyBlocked must be false
7. modifications_pending: Custom modifications must be completed
```

**Reference:** `lib/workflow/resolution-gates.ts`, `lib/actions/crm.ts`

### 1.5 Unit Cycle Workflow (Operations Pipeline)

Each project can enable a 4-stage delivery pipeline:

```
CONTRACT → FINANCE → ENGINEERING → LEGAL_HANDOVER
     ↓          ↓           ↓              ↓
   5 days     5 days      7 days        7 days (default)
```

Each stage has:
- Checklist items (from operations progress tracker)
- Deadline computed from start date
- Status: NOT_STARTED → IN_PROGRESS → BLOCKED → DONE
- Blocking can occur from open requests or archive gap tasks

**Escalation:** Cron job runs at configurable schedule (default: `0 9 * * *`), notifies when overdue.

**Reference:** `lib/unit-cycle/`, `lib/actions/unit-cycle.ts`

### 1.6 Archive Check Workflow

```
Create (single or bulk per project)
     ↓
Seed checklist items based on unit state
     ↓
Operations reviews each item: PENDING → FOUND/MISSING/UNSIGNED
     ↓
Submit (all items must be non-PENDING)
     ↓
Gap tasks created for MISSING/UNSIGNED items
     ↓
Gap tasks assigned to department (LEGAL/FINANCE/MANAGEMENT)
     ↓
Gap task completion → auto-completes request when all done
```

**Reference:** `lib/archive-check/`, `lib/actions/archive-check.ts`

### 1.7 Official Documents Workflow

```
Prepare draft (from template)
     ↓
Edit draft text (versions tracked)
     ↓
Generate PDF (watermarked as draft)
     ↓
Mark signed copy on file (signedCopyOnFileAt)
```

Document types: GRACE_PERIOD_ANNEX, CONTRACT_AMENDMENT, HANDOVER_RECORD, FINISHING_CONTRACT_SUMMARY, UNIT_SWAP_ADDENDUM

**Reference:** `lib/official-documents/`, `lib/actions/official-documents.ts`

---

## Part 2: Issue Register

### 2.1 P0 — Critical Issues

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| P0-001 | **Approved requests don't propagate data** | `lib/actions/unit-requests.ts:approveUnitRequestStepAction` | Approved Contract Amendments, Grace Period Annexes, etc. don't update unit fields. Users must manually update the unit after approval. |
| P0-002 | **No validation that unit data matches approved request** | No implementation | After approval, there's no enforcement that the unit's actual data reflects what was approved. |

### 2.2 P1 — High Priority Issues

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| P1-001 | **No unified activity timeline** | `components/units/` | Cannot see all interactions (calls, requests, documents, status changes) in one chronological view. |
| P1-002 | **Hard-coded approval paths** | `lib/requests/approval-paths.ts` | Cannot configure approval workflows without code changes. |
| P1-003 | **Hard-coded SLAs** | `lib/requests/workflow-helpers.ts:17` | `DEFAULT_REQUEST_DUE_DAYS = 7` for all types. No per-type configuration. |
| P1-004 | **No escalation rules UI** | `lib/unit-cycle/escalation.ts` | Escalation happens but cannot be configured per request type/project. |
| P1-005 | **Archive check items hard-coded** | `lib/archive-check/items.ts` | Checklist items cannot be customized per project. |
| P1-006 | **Finishing phases are enum-based** | `prisma/schema.prisma:FinishingPhase` | Cannot add/modify phases without schema migration. |
| P1-007 | **Handover status is enum-based** | `prisma/schema.prisma:HandoverStatus` | 15 hard-coded statuses with legacy/deprecated values included. |
| P1-008 | **No request template/form builder** | N/A | Each request type has fixed fields. Cannot add conditional fields or custom fields. |

### 2.3 P2 — Medium Priority Issues

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| P2-001 | **No bulk actions** | All table components | Cannot select multiple records for bulk status change, assignment, or approval. |
| P2-002 | **No saved filters** | `lib/cases/cases-filter-url.ts` | URL-based filters exist but cannot be saved/named. |
| P2-003 | **No inline editing** | All tables | Every edit requires modal/page navigation. |
| P2-004 | **No real-time updates** | All pages | Manual refresh required to see other users' changes. |
| P2-005 | **Limited spotlight search** | `lib/actions/spotlight-search.ts` | Only searches units. No global search for cases, requests, documents. |
| P2-006 | **No duplicate detection** | `lib/import/`, client creation | No validation for potential duplicate clients by name/phone/nationalId. |
| P2-007 | **No field-level history** | `lib/audit/with-audit.ts` | Audit log captures old/new JSON but no UI to view field-level changes. |
| P2-008 | **Missing validation on some flows** | Various | E.g., can create handover appointment request without delivery date set. |
| P2-009 | **No email/SMS integration** | N/A | WhatsApp links exist but no actual message sending/tracking. |
| P2-010 | **No reports builder** | `lib/cases/executive-dashboard.ts` | Fixed dashboard charts. Cannot create custom reports. |
| P2-011 | **Engineer account is global** | `lib/auth/role-permissions.ts:130` | Single shared ENGINEER account for all sites. |
| P2-012 | **No mobile app** | N/A | Responsive web only. No native mobile. |

### 2.4 P3 — Low Priority Issues

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| P3-001 | **Deprecated handover statuses in schema** | `prisma/schema.prisma:50-55` | DELIVERED, EXTENSION, LEGAL_DISPUTE still in enum for PostgreSQL compatibility. |
| P3-002 | **Mixed Arabic/English in code comments** | Various | Inconsistent documentation language. |
| P3-003 | **Some unused code paths** | `lib/workflow/cs-handover-fields.ts` | Unused `csFinishingAdditions` path blocked for CS_AGENT. |
| P3-004 | **No customer portal** | N/A | Clients cannot self-service (view status, upload documents). |
| P3-005 | **No knowledge base** | N/A | No FAQ or help article system. |
| P3-006 | **No data export API** | N/A | CSV export exists but no programmatic API. |

---

## Part 3: "Dynamic" Gap Analysis

The owner identified the app as "stale, not dynamic." Here's what that means technically:

### 3.1 Static/Hard-coded Elements (Should Be Configurable)

| Element | Current State | Should Be |
|---------|--------------|-----------|
| **Handover statuses** | 15 enum values in schema | Configurable picklist per project |
| **Finishing phases** | 9 enum values | Configurable checklist per project |
| **Finishing packages** | 14 enum values | Configurable per project |
| **Ticket categories** | 4 enum values | Configurable |
| **Pending parties** | 10 enum values | Configurable |
| **Request types** | 12 types with fixed schemas | Configurable request forms |
| **Approval paths** | Hard-coded in `approval-paths.ts` | UI-configurable workflow builder |
| **SLA deadlines** | 7 days default | Per-type, per-priority, per-project |
| **Archive check items** | Fixed 8 items | Configurable per project |
| **Unit cycle stages** | Fixed 4 stages | Configurable per project |
| **Stage deadlines** | Per-project settings exist | ✓ Partially dynamic |

### 3.2 Missing Reactive/Automation Features

| Feature | Status | Impact |
|---------|--------|--------|
| **Real-time updates** | ❌ Missing | Users don't see others' changes without refresh |
| **Auto-refresh on data change** | ❌ Missing | No WebSocket/polling implementation |
| **Workflow automation rules** | ❌ Missing | No "when X happens, do Y" configuration |
| **Email notifications** | ❌ Missing | In-app only |
| **SMS notifications** | ❌ Missing | — |
| **WhatsApp sending** | ⚠️ Links only | Opens WhatsApp app, doesn't send from CRM |
| **Scheduled reminders** | ⚠️ Cron escalation only | No user-configurable reminders |
| **Auto-assignment rules** | ❌ Missing | No round-robin or rule-based assignment |
| **Approval auto-routing** | ⚠️ Fixed paths | Cannot branch based on conditions |

### 3.3 Missing Self-Service/Configuration UIs

| Feature | Status |
|---------|--------|
| Picklist editor | ❌ |
| Workflow builder | ❌ |
| SLA configuration | ❌ |
| Field layout editor | ❌ |
| Report builder | ❌ |
| Dashboard customization | ❌ |
| Notification preferences | ❌ |
| Template editor | ✓ Document templates exist |

---

## Part 4: Salesforce Gap Analysis

Comparison with Salesforce Service Cloud + Sales Cloud features relevant to real estate after-sales.

### 4.1 Case Management

| Salesforce Feature | NJD-CRM Status | Business Value | Notes |
|--------------------|----------------|----------------|-------|
| Case record type | ⚠️ Partial | High | Has categories but not full record types with page layouts |
| Case status workflow | ✓ Has | High | 4 statuses with gates |
| Case assignment rules | ❌ Missing | High | Manual only |
| Case escalation rules | ⚠️ Cron-based | High | No UI configuration |
| Case SLA/Entitlements | ❌ Missing | Critical | No SLA tracking |
| Case milestone tracking | ❌ Missing | Medium | — |
| Case teams | ❌ Missing | Low | — |
| Omni-channel routing | ❌ Missing | Medium | — |
| Service console | ⚠️ Partial | High | Unit 360 serves similar purpose |

### 4.2 Account & Contact Management

| Salesforce Feature | NJD-CRM Status | Business Value | Notes |
|--------------------|----------------|----------------|-------|
| Account record | ⚠️ Unit-based | High | Unit is the primary record, not Account |
| Contact record | ✓ Client model | High | Supports primary + co-owners |
| Contact roles | ✓ Has | High | PRIMARY, CO_OWNER roles |
| Account hierarchy | ❌ Missing | Low | — |
| Person accounts | ⚠️ Similar | Medium | Clients can exist without units |
| Activity timeline | ❌ Missing | Critical | Only ticket notes, not unified timeline |
| Contact deduplication | ❌ Missing | High | No merge or dedupe |

### 4.3 Workflow & Automation

| Salesforce Feature | NJD-CRM Status | Business Value | Notes |
|--------------------|----------------|----------------|-------|
| Approval processes | ✓ Has | Critical | Fixed paths, no UI builder |
| Flow automation | ❌ Missing | High | No visual automation builder |
| Process builder | ❌ Missing | High | — |
| Field updates on approval | ❌ Missing | Critical | The main gap identified |
| Email alerts | ❌ Missing | High | In-app notifications only |
| Scheduled actions | ⚠️ Cron only | Medium | — |
| Record-triggered flows | ❌ Missing | High | — |

### 4.4 Reports & Dashboards

| Salesforce Feature | NJD-CRM Status | Business Value | Notes |
|--------------------|----------------|----------------|-------|
| Standard reports | ⚠️ Fixed | High | Executive dashboard with fixed charts |
| Custom reports | ❌ Missing | High | No report builder |
| Report folders | ❌ Missing | Medium | — |
| Dashboard components | ⚠️ Fixed | High | Cannot customize |
| Report scheduling | ❌ Missing | Medium | — |
| Report export | ✓ CSV | Medium | Tables export to CSV |

### 4.5 Data Management

| Salesforce Feature | NJD-CRM Status | Business Value | Notes |
|--------------------|----------------|----------------|-------|
| Import wizard | ✓ Excel import | High | Script-based, not UI |
| Data export | ⚠️ CSV only | Medium | No scheduled export |
| Duplicate management | ❌ Missing | High | No duplicate rules |
| Field history | ⚠️ Audit log | Medium | Exists but no field-level UI |
| Recycle bin | ✓ Soft delete | Medium | Records soft-deleted |
| Data loader | ❌ Missing | Low | — |

### 4.6 Security & Access

| Salesforce Feature | NJD-CRM Status | Business Value | Notes |
|--------------------|----------------|----------------|-------|
| Profiles | ✓ Roles | High | 8 role types |
| Permission sets | ❌ Missing | Medium | No additive permissions |
| Record-level sharing | ⚠️ Agent assignment | Medium | Based on unit.agentId |
| Field-level security | ❌ Missing | Medium | Role-based at page level |
| Login IP ranges | ❌ Missing | Low | — |
| Session settings | ✓ Has | Medium | 8-hour timeout, browser-close logout |
| 2FA | ✓ Required | High | TOTP-based |

### 4.7 Integration & API

| Salesforce Feature | NJD-CRM Status | Business Value | Notes |
|--------------------|----------------|----------------|-------|
| REST API | ⚠️ Next.js actions | Low | Server actions, not REST |
| Bulk API | ❌ Missing | Low | — |
| Webhooks (outbound) | ❌ Missing | Medium | — |
| Connected apps | ❌ Missing | Low | — |
| AppExchange | ❌ N/A | — | — |

---

## Part 5: Prioritized Roadmap

### Quick Wins (Estimated < 1 week each)

| # | Item | Effort | Rationale |
|---|------|--------|-----------|
| 1 | **Implement auto-data-propagation on request approval** | 3-5 days | Fixes the #1 gap; straightforward — add `updateUnitOnApproval()` per request type |
| 2 | **Add unified activity timeline component** | 3-4 days | Query tickets, requests, audit events, documents; render chronologically |
| 3 | **Add inline edit for key table cells** | 2-3 days | Status, assignment dropdowns on cases table |
| 4 | **Implement bulk selection on cases/units tables** | 2-3 days | Checkbox column, action bar |
| 5 | **Add saved filters for cases page** | 2-3 days | Store filter presets in SystemSetting or user preference table |
| 6 | **Add field-level history viewer** | 3-4 days | UI to expand audit log entries, show field diffs |

### Medium Effort (Estimated 1-3 weeks each)

| # | Item | Effort | Rationale |
|---|------|--------|-----------|
| 7 | **SLA configuration per request type** | 1-2 weeks | Add `RequestTypeSLA` model, UI in project settings, update `computeDefaultDueDate` |
| 8 | **Configurable picklists** | 2-3 weeks | Add `Picklist` model, migrate enums to lookup, build UI editor |
| 9 | **Global search across all entities** | 1-2 weeks | Extend spotlight to search cases, requests, documents, clients |
| 10 | **Duplicate detection on client create** | 1 week | Show warning when phone/nationalId/name matches existing client |
| 11 | **Email notification integration** | 2 weeks | Add email service (SendGrid/Resend), trigger on key events |
| 12 | **Custom dashboard widgets** | 2-3 weeks | Allow users to configure dashboard layout and metrics |

### Large Effort (Estimated 1+ months each)

| # | Item | Effort | Rationale |
|---|------|--------|-----------|
| 13 | **Workflow automation builder** | 4-6 weeks | Visual builder for "when X, do Y" rules (like Salesforce Flow lite) |
| 14 | **Real-time updates (WebSocket)** | 3-4 weeks | Add WebSocket server, subscription model, optimistic UI updates |
| 15 | **Reports builder** | 4-6 weeks | Custom report definition UI, grouping, aggregation, scheduling |
| 16 | **Customer portal** | 6-8 weeks | Client self-service: view status, upload documents, request appointments |
| 17 | **WhatsApp Business API integration** | 4-6 weeks | Send messages from CRM, track delivery, receive replies |
| 18 | **Mobile native app** | 8-12 weeks | React Native or Flutter app for field staff |

---

## Part 6: Manual Test Checklist

This checklist can be used for a walk-through session with the team. Each row is one test step.

### 6.1 Authentication & Access

| Step | Role | Action | Expected Result | Pass/Fail |
|------|------|--------|-----------------|-----------|
| 1.1 | — | Navigate to `/en/login` | Login page displays | |
| 1.2 | CS_AGENT | Login with valid credentials | Redirected to 2FA setup (first login) or verify | |
| 1.3 | CS_AGENT | Complete 2FA setup | QR code displays, can scan and verify | |
| 1.4 | CS_AGENT | Verify 2FA code | Redirected to `/dashboard` | |
| 1.5 | MANAGEMENT | Login and verify 2FA | Redirected to `/executive` | |
| 1.6 | ENGINEER | Login | Redirected to `/engineering` (no 2FA required) | |
| 1.7 | SUPER_ADMIN | Enable maintenance mode in `/system/general-settings` | Mode activates | |
| 1.8 | CS_AGENT | Try to access `/dashboard` with maintenance mode on | Redirected to `/maintenance` | |
| 1.9 | SUPER_ADMIN | Disable maintenance mode | CS_AGENT can access dashboard | |

### 6.2 Unit Management

| Step | Role | Action | Expected Result | Pass/Fail |
|------|------|--------|-----------------|-----------|
| 2.1 | MANAGEMENT | Navigate to `/units` | Unit list displays | |
| 2.2 | MANAGEMENT | Search for unit by code | Unit appears in list | |
| 2.3 | MANAGEMENT | Click unit to open Unit 360 | Detail page opens with tabs | |
| 2.4 | MANAGEMENT | Edit client name and save | Name updates, toast shows | |
| 2.5 | CS_AGENT | Use Cmd+K to search any unit | Unit found (even if not assigned) | |
| 2.6 | CS_AGENT | Open unit not assigned to them | Can view but not edit all fields | |
| 2.7 | CS_AGENT | Try to edit Legal tab on unassigned unit | Should be blocked | |
| 2.8 | CS_AGENT | Log call on unassigned unit | Call logs successfully | |
| 2.9 | OPERATIONS | Navigate to unit via `/operations/units/[id]` | Shows operations view | |
| 2.10 | OPERATIONS | Toggle "Papers Received" | Field updates | |

### 6.3 Case/Ticket Management

| Step | Role | Action | Expected Result | Pass/Fail |
|------|------|--------|-----------------|-----------|
| 3.1 | MANAGEMENT | Navigate to `/cases` | Case list displays | |
| 3.2 | MANAGEMENT | Filter by status = PENDING | List filters | |
| 3.3 | MANAGEMENT | Assign case to CS agent | Assignment succeeds, notification sent | |
| 3.4 | CS_AGENT | View assigned case on dashboard | Case appears in pending work | |
| 3.5 | CS_AGENT | Update case status to ENGINEERING | Status changes, pendingParty set | |
| 3.6 | CS_AGENT | Try to resolve case without gates met | Error message shows unmet gates | |
| 3.7 | MANAGEMENT | Resolve case with management override | Case resolves with override note | |
| 3.8 | MANAGEMENT | Reopen resolved case | Case reopens to PENDING | |
| 3.9 | CS_AGENT | Create new case on assigned unit | Case created | |
| 3.10 | CS_AGENT | Try to create case on unassigned unit | Should be blocked (unless log call) | |

### 6.4 Request Workflow

| Step | Role | Action | Expected Result | Pass/Fail |
|------|------|--------|-----------------|-----------|
| 4.1 | CS_AGENT | Create CONTRACT_ISSUE_OR_AMENDMENT request | Draft created | |
| 4.2 | CS_AGENT | Add description and attachment | Saves successfully | |
| 4.3 | CS_AGENT | Submit request | Status → PENDING, currentApproverKind → LEGAL | |
| 4.4 | LEGAL | View request in inbox | Request visible | |
| 4.5 | LEGAL | Approve request | Advances to MANAGEMENT step | |
| 4.6 | MANAGEMENT | Approve request | Status → APPROVED | |
| 4.7 | — | Check if unit data updated | ⚠️ **Data NOT auto-updated** (gap) | |
| 4.8 | CS_AGENT | Create UNIT_SWAP request | Draft created | |
| 4.9 | MANAGEMENT | Approve unit swap | Client moves to target unit | |
| 4.10 | OPERATIONS | Create bulk archive check for project | Parent + child requests created | |

### 6.5 Operations Workflow

| Step | Role | Action | Expected Result | Pass/Fail |
|------|------|--------|-----------------|-----------|
| 5.1 | OPERATIONS | Navigate to `/operations` | Operations dashboard displays | |
| 5.2 | OPERATIONS | Filter by project | List filters | |
| 5.3 | OPERATIONS | Click unit to view progress | Progress tracker shows | |
| 5.4 | OPERATIONS | Open archive check request | Checklist items display | |
| 5.5 | OPERATIONS | Mark item as FOUND | Status updates | |
| 5.6 | OPERATIONS | Upload scan for item | Attachment uploads | |
| 5.7 | OPERATIONS | Mark all items and submit | Gap tasks created for MISSING/UNSIGNED | |
| 5.8 | LEGAL | Complete assigned gap task | Task completes | |
| 5.9 | — | Check if archive check auto-completes | Completes when all gaps done | |

### 6.6 Official Documents

| Step | Role | Action | Expected Result | Pass/Fail |
|------|------|--------|-----------------|-----------|
| 6.1 | MANAGEMENT | Open Unit 360 → Documents tab | Documents list shows | |
| 6.2 | MANAGEMENT | Create new handover record draft | Draft opens in editor | |
| 6.3 | MANAGEMENT | Edit draft text | Saves with version history | |
| 6.4 | MANAGEMENT | Generate PDF | PDF downloads (watermarked) | |
| 6.5 | SUPER_ADMIN | Navigate to document templates | Template list shows | |
| 6.6 | SUPER_ADMIN | Create new template version | Version saves, becomes active | |

### 6.7 Notifications

| Step | Role | Action | Expected Result | Pass/Fail |
|------|------|--------|-----------------|-----------|
| 7.1 | CS_AGENT | Check notification bell | Shows unread count if any | |
| 7.2 | MANAGEMENT | Assign case to CS agent | CS agent receives notification | |
| 7.3 | CS_AGENT | Log call on another agent's unit | That agent receives notification | |
| 7.4 | — | Check notification includes link | Link navigates to correct page | |
| 7.5 | CS_AGENT | Mark notification as read | Badge updates | |
| 7.6 | SUPER_ADMIN | View notifications log | All notifications visible | |

### 6.8 System Administration

| Step | Role | Action | Expected Result | Pass/Fail |
|------|------|--------|-----------------|-----------|
| 8.1 | SUPER_ADMIN | Navigate to `/backups` | Backup list shows | |
| 8.2 | SUPER_ADMIN | Trigger manual backup | Backup completes, appears in list | |
| 8.3 | SUPER_ADMIN | Download backup | Archive downloads | |
| 8.4 | SUPER_ADMIN | View audit logs | Logs display with filters | |
| 8.5 | SUPER_ADMIN | View system monitoring | Health metrics display | |
| 8.6 | SUPER_ADMIN | Kill user sessions | Sessions invalidated | |
| 8.7 | SUPER_ADMIN | Create new user | User created | |
| 8.8 | SUPER_ADMIN | Force password reset for user | User must change password on next login | |

### 6.9 Engineering Portal

| Step | Role | Action | Expected Result | Pass/Fail |
|------|------|--------|-----------------|-----------|
| 9.1 | ENGINEER | Login | Redirected to `/engineering` | |
| 9.2 | ENGINEER | View task queue | Units with ENGINEERING pendingParty show | |
| 9.3 | ENGINEER | Open unit task | Finishing checklist displays | |
| 9.4 | ENGINEER | Update finishing phases | Phases save | |
| 9.5 | ENGINEER | Return to Customer Service | Ticket pendingParty → CUSTOMER_SERVICE | |
| 9.6 | CS_AGENT | Receive notification of return | Notification received | |
| 9.7 | ENGINEER | Try to access `/dashboard` | Blocked/redirected | |

### 6.10 Localization

| Step | Role | Action | Expected Result | Pass/Fail |
|------|------|--------|-----------------|-----------|
| 10.1 | — | Switch language to Arabic | UI switches to RTL, Arabic text | |
| 10.2 | — | Verify table headers RTL | Columns align correctly | |
| 10.3 | — | Verify sidebar on right | Sidebar moves to right side | |
| 10.4 | — | Switch back to English | UI returns to LTR | |

---

## Part 7: Code Reference Index

### Key Action Files

| File | Purpose |
|------|---------|
| `lib/actions/crm.ts` | User CRUD, ticket CRUD, finishing, handover checklist |
| `lib/actions/unit-requests.ts` | Request CRUD, approval, rejection |
| `lib/actions/unit-swap.ts` | Unit client swap logic |
| `lib/actions/unit-cycle.ts` | Unit cycle stage management |
| `lib/actions/archive-check.ts` | Archive check workflow |
| `lib/actions/official-documents.ts` | Document drafts and generation |
| `lib/actions/signed-protocol.ts` | Signed protocol upload |
| `lib/actions/unit-documents.ts` | Contract/annex document uploads |

### Key Workflow Files

| File | Purpose |
|------|---------|
| `lib/requests/approval-paths.ts` | Request type → approval chain mapping |
| `lib/requests/workflow-helpers.ts` | State machine helpers |
| `lib/requests/permissions-core.ts` | Request permission logic |
| `lib/workflow/resolution-gates.ts` | Case resolution validation |
| `lib/unit-cycle/stage-rules.ts` | Unit cycle completion rules |
| `lib/archive-check/gap-tasks.ts` | Archive gap task creation/completion |
| `lib/notifications/triggers.ts` | Notification event triggers |

### Key Permission Files

| File | Purpose |
|------|---------|
| `lib/rbac.ts` | Route-level access control |
| `lib/auth/role-permissions.ts` | Feature-level permissions |
| `lib/auth/unit-roles.ts` | Role type helpers |
| `lib/auth/cs-agent-scope.ts` | CS agent unit access |
| `lib/official-documents/permissions.ts` | Document permissions |

---

## Part 8: Recommendations Summary

### Immediate Actions (This Week)

1. **Implement approval-to-unit data propagation** — Add `applyApprovalToUnit()` function in `lib/actions/unit-requests.ts` that updates unit fields when certain request types are approved.

2. **Add unified activity timeline** — Create a component that queries `Ticket`, `UnitRequest`, `AuditLog`, `UnitGeneratedDocument` and renders chronologically on Unit 360.

3. **Review and document all manual processes** — Where the app falls short, document the manual workarounds staff use today.

### Short-Term (This Month)

4. **Build SLA configuration UI** — Allow per-request-type deadline configuration.

5. **Add bulk actions to cases table** — Multi-select, bulk status change, bulk assignment.

6. **Implement saved filter presets** — Personal and shared filter combinations.

### Medium-Term (Next Quarter)

7. **Begin workflow automation foundation** — Start with simple auto-actions (e.g., auto-assign based on project).

8. **Add email notification channel** — Complement in-app notifications.

9. **Build reports customization** — Allow users to configure dashboard widgets.

---

## Appendix A: Database Schema Summary

**Core Entities:**
- `User` — 8 roles, 2FA, session management
- `Project` — 5 projects, unit cycle settings
- `Client` — Owners with phones, addresses
- `Unit` — The central entity, linked to project, client, agent
- `Ticket` — Cases with status workflow
- `UnitRequest` — Request/approval workflow
- `UnitCycle` / `UnitCycleStage` — Operations pipeline

**Supporting Entities:**
- `ContractWorkflow` — Handover status and checklist
- `Finishing` — Finishing details and phases
- `Notification` — In-app notifications
- `AuditLog` — Change tracking
- `BackupLog` — Backup history

---

## Appendix B: Cron Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| `backup-cron` | `0 2 * * *` (2 AM) | Daily full backup |
| `unit-cycle-cron` | `0 9 * * *` (9 AM) | Overdue stage escalation |
| `request-escalation-cron` | `0 9 * * *` | Overdue request escalation |
| `archive-gap-cron` | `0 9 * * *` | Overdue gap task escalation |

---

## Appendix C: Environment Variables

Key configuration in `.env`:

```
DATABASE_URL            # PostgreSQL connection
AUTH_SECRET             # NextAuth secret
AUTH_URL                # Base URL for auth callbacks
AUTH_SESSION_MAX_AGE_SECONDS   # Session timeout (default 28800 = 8h)
BACKUP_DIR              # Backup storage location
UPLOADS_DIR             # Document upload location
BACKUP_CRON             # Backup schedule
S3_*                    # Optional S3/R2 for remote backups
```

---

*End of audit report. For questions, contact the development team or reference the git history.*
