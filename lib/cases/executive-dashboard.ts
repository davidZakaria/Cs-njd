import { prisma } from "@/lib/prisma";
import { getEffectiveCaseAgent, isCaseOwnedByUser } from "@/lib/cases/ownership";
import { OPEN_TICKET_STATUSES } from "@/lib/cases/workflow";
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

export type ExecutiveDashboardData = {
  stats: {
    openTotal: number;
    unassigned: number;
    legal: number;
    engineering: number;
    myOpen: number;
    teamOpen: number;
  };
  agentWorkload: AgentWorkload[];
  teamQueue: ExecutiveCaseRow[];
  myQueue: ExecutiveCaseRow[];
  agents: Array<{ id: string; name: string }>;
};

function queuePriority(row: ExecutiveCaseRow) {
  const unassigned = !row.agentId && !row.unitAgentId;
  if (unassigned) return 0;
  if (row.status === "LEGAL" || row.category === "LEGAL") return 1;
  if (row.status === "ENGINEERING") return 2;
  if (row.status === "PENDING") return 3;
  return 4;
}

function toExecutiveRow(
  ticket: {
    id: string;
    notes: string;
    category: string;
    status: string;
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

export async function getExecutiveDashboardData(
  managerId: string
): Promise<ExecutiveDashboardData> {
  const [openTickets, agents] = await Promise.all([
    prisma.ticket.findMany({
      where: { status: { in: OPEN_TICKET_STATUSES } },
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
  ]);

  const rows = openTickets.map((ticket) => toExecutiveRow(ticket, managerId));
  const teamRows = rows.filter((row) => !row.isMine);
  const myRows = rows.filter((row) => row.isMine);

  const unassigned = teamRows.filter(
    (row) => !row.agentId && !row.unitAgentId
  ).length;

  const legal = rows.filter(
    (row) => row.status === "LEGAL" || row.category === "LEGAL"
  ).length;

  const engineering = rows.filter((row) => row.status === "ENGINEERING").length;

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
    const bucket =
      workloadMap.get(key) ??
      workloadMap.get("unassigned")!;
    bucket.openCount += 1;
    if (row.status === "PENDING") bucket.pendingCount += 1;
    if (row.status === "LEGAL" || row.category === "LEGAL") {
      bucket.legalCount += 1;
    }
    if (row.status === "ENGINEERING") bucket.engineeringCount += 1;
  }

  const agentWorkload = [...workloadMap.values()]
    .filter((item) => item.openCount > 0)
    .sort((a, b) => b.openCount - a.openCount);

  const sortQueue = (items: ExecutiveCaseRow[]) =>
    [...items].sort((a, b) => queuePriority(a) - queuePriority(b));

  return {
    stats: {
      openTotal: rows.length,
      unassigned,
      legal,
      engineering,
      myOpen: myRows.length,
      teamOpen: teamRows.length,
    },
    agentWorkload,
    teamQueue: sortQueue(teamRows).slice(0, 30),
    myQueue: sortQueue(myRows).slice(0, 10),
    agents,
  };
}
