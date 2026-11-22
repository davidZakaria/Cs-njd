# Dashboard metric ↔ list parity

Single filter definitions drive both KPI counts and drill-down lists.

## Root causes fixed

| Card | Old mismatch cause | New business definition |
|------|--------------------|-------------------------|
| Legal Disputes (role dashboard) | `contractWorkflow.count` included soft-deleted workflows; units list used live workflow or `PENDING` | Active units whose **non-deleted** workflow `handoverStatus` is in `LEGAL_DISPUTE_HANDOVER_STATUSES` |
| Executive Unassigned | Distinct **units** (team queue, no ticket/unit agent); list counted every **ticket** with “unassigned” effective agent | Distinct team open units with `agentId` and `unitAgentId` both null; URL `distinctUnit=1&queue=team` |
| Open total / Legal / Engineering breakdown | Unique units by primary status; list showed all open tickets or raw status | Primary status per unit (Legal → Engineering → Pending); URL `primaryStatus` + `distinctUnit=1` |
| Delivered / legal risk / delivery overdue (executive) | Workflow row counts vs unit rows on list | `unit.count` with `activeContractWorkflow` + shared `unitWhereForDashboardFilters` |
| Project table unassigned | Unit `agentId` null (unchanged); already matched `/units?agent=unassigned` | Same — unit CS agent unset |
| Signed protocol missing | 100% when no uploads tracked | Count only when protocol signals exist; otherwise KPI shows **Not tracked** |
| Outstanding fees | 0% when fee columns never populated | Same **Not tracked** when no finishing fee data |
| Resolved KPIs | Unique units; list all resolved tickets | `distinctUnit=1` on resolved drill-downs |

## Shared modules

- `lib/units/unit-dashboard-filters.ts` — row mapping, `matchesUnitDashboardFilters`, Prisma where builder
- `lib/cases/case-dashboard-filters.ts` — `filterCaseDashboardRows` (distinct units, primary status, team queue)
- `lib/dashboard/unit-metric-counts.ts` — server counts
- `lib/dashboard/executive-metric-urls.ts` — executive drill-down URLs

## Tests

- `__tests__/lib/dashboard-metric-parity.test.ts` — seeded fake rows assert count === list
- `npm run e2e:dashboard-metric-parity` — Playwright click-through (needs app + auth; optional in CI)