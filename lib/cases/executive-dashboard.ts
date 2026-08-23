import { prisma } from "@/lib/prisma";
import { activeTicketWhere } from "@/lib/prisma";
import { getEffectiveCaseAgent, isCaseOwnedByUser } from "@/lib/cases/ownership";
import { OPEN_TICKET_STATUSES } from "@/lib/cases/workflow";
import {
  CANONICAL_PROJECTS,
  PROJECT_SLUGS,
  type CanonicalProject,
} from "@/lib/projects";
import { getAssignableAgentEmails } from "@/lib/staff";

export type ExecutiveCaseRow = {
  id: string;
  unitId: string;
  unitCode: string;
  project: string;
  client: string;
  notes: string;
  category: string;
  status: string;
  pendingParty: string;
  agentId: string | null;
  agentName: string;
  unitAgentId: string | null;
  isMine: boolean;
};

export type AgentWorkload = {
  agentId: string | null;
  agentName: string;
  openCount: number;
  pendingCount: number;
  legalCount: number;
  engineeringCount: number;
};

export type ExecutiveStats = {
  openTotal: number;
  unassigned: number;
  legal: number;
  engineering: number;
  myOpen: number;
  teamOpen: number;
  pending: number;
  pendingWithParty: number;
};

export type CategoryBreakdown = {
  legal: number;
  engineering: number;
  customerService: number;
  feedbackHistory: number;
  general: number;
};

export type ProjectOpenCount = {
  project: string;
  slug: string;
  count: number;
};

export type ProjectDashboardSlice = {
  project: string;
  slug: string;
  stats: ExecutiveStats;
  resolvedStats: ResolvedStats;
  categoryBreakdown: CategoryBreakdown;
  resolvedCategoryBreakdown: CategoryBreakdown;
  agentWorkload: AgentWorkload[];
  teamQueue: ExecutiveCaseRow[];
  myQueue: ExecutiveCaseRow[];
  resolvedTeamQueue: ExecutiveCaseRow[];
  resolvedMyQueue: ExecutiveCaseRow[];
};

export type ExecutiveDashboardData = {
  /** @deprecated Use `global.stats` — kept for current page until Step 4 */
  stats: ExecutiveStats;
  /** @deprecated Use `global.agentWorkload` */
  agentWorkload: AgentWorkload[];
  teamQueue: ExecutiveCaseRow[];
  myQueue: ExecutiveCaseRow[];
  agents: Array<{ id: string; name: string }>;
  global: {
    stats: ExecutiveStats;
    categoryBreakdown: CategoryBreakdown;
    agentWorkload: AgentWorkload[];
    projectsOpenCounts: ProjectOpenCount[];
  };
  byProject: ProjectDashboardSlice[];
  resolved: {
    stats: ResolvedStats;
    categoryBreakdown: CategoryBreakdown;
    projectsResolvedCounts: ProjectOpenCount[];
    teamQueue: ExecutiveCaseRow[];
    myQueue: ExecutiveCaseRow[];
  };
};

export type ResolvedStats = {
  resolvedTotal: number;
  myResolved: number;
  teamResolved: number;
};

function queuePriority(row: ExecutiveCaseRow) {
  const unassigned = !row.agentId && !row.unitAgentId;
  if (unassigned) return 0;
  if (row.status === "LEGAL" || row.category === "LEGAL") return 1;
  if (row.status === "ENGINEERING") return 2;
  if (row.status === "PENDING") return 3;
  return 4;
}

function sortQueue(items: ExecutiveCaseRow[]) {
  return [...items].sort((a, b) => queuePriority(a) - queuePriority(b));
}

function toExecutiveRow(
  ticket: {
    id: string;
    notes: string;
    category: string;
    status: string;
    pendingParty: string | null;
    agentId: string | null;
    agent: { name: string } | null;
    unitId: string;
    unit: {
      unitCode: string;
      agentId: string | null;
      agent: { name: string } | null;
      project: { name: string };
      client: { name: string } | null;
    };
  },
  managerId: string
): ExecutiveCaseRow {
  const effective = getEffectiveCaseAgent(
    ticket.agentId,
    ticket.agent?.name,
    ticket.unit.agentId,
    ticket.unit.agent?.name
  );

  return {
    id: ticket.id,
    unitId: ticket.unitId,
    unitCode: ticket.unit.unitCode,
    project: ticket.unit.project.name,
    client: ticket.unit.client?.name ?? "-",
    notes: ticket.notes,
    category: ticket.category,
    status: ticket.status,
    pendingParty: ticket.pendingParty ?? "NONE",
    agentId: ticket.agentId,
    agentName: effective.name,
    unitAgentId: ticket.unit.agentId,
    isMine: isCaseOwnedByUser(
      ticket.agentId,
      ticket.unit.agentId,
      managerId
    ),
  };
}

function computeStats(rows: ExecutiveCaseRow[]): ExecutiveStats {
  const teamRows = rows.filter((row) => !row.isMine);
  const myRows = rows.filter((row) => row.isMine);

  return {
    openTotal: rows.length,
    unassigned: teamRows.filter((row) => !row.agentId && !row.unitAgentId).length,
    legal: rows.filter(
      (row) => row.status === "LEGAL" || row.category === "LEGAL"
    ).length,
    engineering: rows.filter((row) => row.status === "ENGINEERING").length,
    myOpen: myRows.length,
    teamOpen: teamRows.length,
    pending: rows.filter((row) => row.status === "PENDING").length,
    pendingWithParty: rows.filter(
      (row) => row.pendingParty && row.pendingParty !== "NONE"
    ).length,
  };
}

function computeCategoryBreakdown(rows: ExecutiveCaseRow[]): CategoryBreakdown {
  return {
    legal: rows.filter(
      (row) => row.status === "LEGAL" || row.category === "LEGAL"
    ).length,
    engineering: rows.filter((row) => row.status === "ENGINEERING").length,
    customerService: rows.filter((row) => row.category === "CUSTOMER_SERVICE")
      .length,
    feedbackHistory: rows.filter((row) => row.category === "FEEDBACK_HISTORY")
      .length,
    general: rows.filter((row) => row.category === "GENERAL").length,
  };
}

function computeAgentWorkload(
  rows: ExecutiveCaseRow[],
  agents: Array<{ id: string; name: string }>
): AgentWorkload[] {
  const workloadMap = new Map<string, AgentWorkload>();

  for (const agent of agents) {
    workloadMap.set(agent.id, {
      agentId: agent.id,
      agentName: agent.name,
      openCount: 0,
      pendingCount: 0,
      legalCount: 0,
      engineeringCount: 0,
    });
  }

  workloadMap.set("unassigned", {
    agentId: null,
    agentName: "Unassigned",
    openCount: 0,
    pendingCount: 0,
    legalCount: 0,
    engineeringCount: 0,
  });

  for (const row of rows) {
    const key = row.agentId ?? row.unitAgentId ?? "unassigned";
    const bucket = workloadMap.get(key) ?? workloadMap.get("unassigned")!;
    bucket.openCount += 1;
    if (row.status === "PENDING") bucket.pendingCount += 1;
    if (row.status === "LEGAL" || row.category === "LEGAL") {
      bucket.legalCount += 1;
    }
    if (row.status === "ENGINEERING") bucket.engineeringCount += 1;
  }

  return [...workloadMap.values()]
    .filter((item) => item.openCount > 0)
    .sort((a, b) => b.openCount - a.openCount);
}

function computeResolvedStats(rows: ExecutiveCaseRow[]): ResolvedStats {
  return {
    resolvedTotal: rows.length,
    myResolved: rows.filter((row) => row.isMine).length,
    teamResolved: rows.filter((row) => !row.isMine).length,
  };
}

function buildResolvedProjectCounts(
  rows: ExecutiveCaseRow[],
  orderedProjectNames: string[]
): ProjectOpenCount[] {
  return orderedProjectNames.map((project) => ({
    project,
    slug: projectSlug(project),
    count: rows.filter((row) => row.project === project).length,
  }));
}

function projectSlug(name: string): string {
  if ((CANONICAL_PROJECTS as readonly string[]).includes(name)) {
    return PROJECT_SLUGS[name as CanonicalProject];
  }
  return name.toLowerCase().replace(/\s+/g, "-");
}

function buildProjectSlice(
  projectName: string,
  openRows: ExecutiveCaseRow[],
  resolvedRows: ExecutiveCaseRow[],
  agents: Array<{ id: string; name: string }>
): ProjectDashboardSlice {
  const projectOpenRows = openRows.filter((row) => row.project === projectName);
  const projectResolvedRows = resolvedRows.filter(
    (row) => row.project === projectName
  );
  const teamRows = projectOpenRows.filter((row) => !row.isMine);
  const myRows = projectOpenRows.filter((row) => row.isMine);
  const resolvedTeamRows = projectResolvedRows.filter((row) => !row.isMine);
  const resolvedMyRows = projectResolvedRows.filter((row) => row.isMine);

  return {
    project: projectName,
    slug: projectSlug(projectName),
    stats: computeStats(projectOpenRows),
    resolvedStats: computeResolvedStats(projectResolvedRows),
    categoryBreakdown: computeCategoryBreakdown(projectOpenRows),
    resolvedCategoryBreakdown: computeCategoryBreakdown(projectResolvedRows),
    agentWorkload: computeAgentWorkload(projectOpenRows, agents),
    teamQueue: sortQueue(teamRows).slice(0, 30),
    myQueue: sortQueue(myRows).slice(0, 10),
    resolvedTeamQueue: resolvedTeamRows.slice(0, 30),
    resolvedMyQueue: resolvedMyRows.slice(0, 10),
  };
}

export async function getExecutiveDashboardData(
  managerId: string
): Promise<ExecutiveDashboardData> {
  const [openTickets, resolvedTickets, agents, dbProjects] = await Promise.all([
    prisma.ticket.findMany({
      where: activeTicketWhere({ status: { in: OPEN_TICKET_STATUSES } }),
      include: {
        agent: { select: { name: true } },
        unit: {
          include: {
            project: { select: { name: true } },
            client: { select: { name: true } },
            agent: { select: { name: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.ticket.findMany({
      where: activeTicketWhere({ status: "RESOLVED" }),
      include: {
        agent: { select: { name: true } },
        unit: {
          include: {
            project: { select: { name: true } },
            client: { select: { name: true } },
            agent: { select: { name: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.user.findMany({
      where: { email: { in: getAssignableAgentEmails() } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { name: true },
    }),
  ]);

  const rows = openTickets.map((ticket) => toExecutiveRow(ticket, managerId));
  const teamRows = rows.filter((row) => !row.isMine);
  const myRows = rows.filter((row) => row.isMine);

  const globalStats = computeStats(rows);
  const globalCategoryBreakdown = computeCategoryBreakdown(rows);
  const globalAgentWorkload = computeAgentWorkload(rows, agents);

  const projectNamesInData = new Set([
    ...rows.map((row) => row.project),
    ...resolvedTickets.map((ticket) => ticket.unit.project.name),
  ]);
  const orderedProjectNames = [
    ...CANONICAL_PROJECTS.filter(
      (name) =>
        projectNamesInData.has(name) ||
        dbProjects.some((project) => project.name === name)
    ),
    ...dbProjects
      .map((project) => project.name)
      .filter(
        (name) =>
          !(CANONICAL_PROJECTS as readonly string[]).includes(name) &&
          projectNamesInData.has(name)
      ),
  ];

  const projectsOpenCounts: ProjectOpenCount[] = orderedProjectNames.map(
    (project) => ({
      project,
      slug: projectSlug(project),
      count: rows.filter((row) => row.project === project).length,
    })
  );

  const resolvedRows = resolvedTickets.map((ticket) =>
    toExecutiveRow(ticket, managerId)
  );
  const resolvedTeamRows = resolvedRows.filter((row) => !row.isMine);
  const resolvedMyRows = resolvedRows.filter((row) => row.isMine);

  const byProject = orderedProjectNames.map((projectName) =>
    buildProjectSlice(projectName, rows, resolvedRows, agents)
  );

  return {
    stats: globalStats,
    agentWorkload: globalAgentWorkload,
    teamQueue: sortQueue(teamRows).slice(0, 30),
    myQueue: sortQueue(myRows).slice(0, 10),
    agents,
    global: {
      stats: globalStats,
      categoryBreakdown: globalCategoryBreakdown,
      agentWorkload: globalAgentWorkload,
      projectsOpenCounts,
    },
    byProject,
    resolved: {
      stats: computeResolvedStats(resolvedRows),
      categoryBreakdown: computeCategoryBreakdown(resolvedRows),
      projectsResolvedCounts: buildResolvedProjectCounts(
        resolvedRows,
        orderedProjectNames
      ),
      teamQueue: sortQueue(resolvedTeamRows).slice(0, 30),
      myQueue: sortQueue(resolvedMyRows).slice(0, 10),
    },
  };
}
