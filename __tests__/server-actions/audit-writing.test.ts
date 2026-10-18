import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@prisma/client";

import {
  asyncAuditContext,
  recordAuditRowIfContext,
  runWithAsyncAuditContext,
  type SimulatedAuditRow,
} from "../helpers/async-audit-context";

const mockAuth = vi.fn();
const auditRows: SimulatedAuditRow[] = [];

const mockPrismaTicket = {
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};
const mockPrismaUnit = {
  findUnique: vi.fn(),
};
const mockPrismaFinishing = {
  upsert: vi.fn(),
};
const mockPrismaContractWorkflow = {
  upsert: vi.fn(),
};
const mockPrismaClientPhone = {
  create: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ticket: mockPrismaTicket,
    unit: mockPrismaUnit,
    finishing: mockPrismaFinishing,
    contractWorkflow: mockPrismaContractWorkflow,
    clientPhone: mockPrismaClientPhone,
  },
  auditContext: {
    run: runWithAsyncAuditContext,
  },
}));

vi.mock("next/headers", () => ({
  headers: () =>
    Promise.resolve({
      get: () => "127.0.0.1",
    }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/notifications/dispatch-ticket-notifications", () => ({
  dispatchTicketWorkflowNotifications: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/notifications/dispatch-activity-notifications", () => ({
  dispatchAnsweredCallLogActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/notifications/triggers", () => ({
  notifyInboundCall: vi.fn().mockResolvedValue(undefined),
}));

function session(user: { id: string; role: Role; name?: string; email?: string }) {
  return {
    user: {
      id: user.id,
      role: user.role,
      name: user.name ?? "Test User",
      email: user.email ?? "user@test.com",
    },
    expires: new Date(Date.now() + 3600 * 1000).toISOString(),
  };
}

describe("server actions write audit context for mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditRows.length = 0;

    mockPrismaTicket.create.mockImplementation(async () => {
      recordAuditRowIfContext("Ticket", "CREATE", auditRows);
      return { id: "ticket-new" };
    });
    mockPrismaFinishing.upsert.mockImplementation(async () => {
      recordAuditRowIfContext("Finishing", "UPDATE", auditRows);
      return { id: "finishing-1", unitId: "unit-1" };
    });
    mockPrismaClientPhone.create.mockImplementation(async () => {
      recordAuditRowIfContext("ClientPhone", "CREATE", auditRows);
      return { id: "phone-new" };
    });
  });

  it("createTicket records the acting user for the case create", async () => {
    const actorId = "cs-agent-1";
    mockAuth.mockResolvedValue(session({ id: actorId, role: "CS_AGENT" }));
    mockPrismaUnit.findUnique.mockResolvedValue({
      id: "unit-1",
      agentId: actorId,
      unitCode: "A-101",
    });

    const { createTicket } = await import("@/lib/actions/crm");
    const formData = new FormData();
    formData.set("unitId", "unit-1");
    formData.set("notes", "New case notes");

    const result = await createTicket(formData);

    expect(result.success).toBe(true);
    expect(auditRows).toContainEqual({
      userId: actorId,
      tableName: "Ticket",
      action: "CREATE",
    });
  });

  it("logCallQuickAction records the acting user for the call log case", async () => {
    const actorId = "community-1";
    mockAuth.mockResolvedValue(session({ id: actorId, role: "COMMUNITY_MANAGEMENT" }));
    mockPrismaUnit.findUnique.mockResolvedValue({
      id: "unit-1",
      agentId: "agent-1",
      unitCode: "A-1",
      agent: { id: "agent-1" },
      project: { id: "proj-jamila", name: "JAMILA NORTH COAST" },
      client: { name: "Client" },
    });

    const { logCallQuickAction } = await import("@/lib/actions/crm");
    const result = await logCallQuickAction({
      unitId: "unit-1",
      notes: "Called client about delivery",
    });

    expect(result.success).toBe(true);
    expect(auditRows).toContainEqual({
      userId: actorId,
      tableName: "Ticket",
      action: "CREATE",
    });
  });

  it("updateFinishing records the acting user for finishing changes", async () => {
    const actorId = "admin-1";
    mockAuth.mockResolvedValue(session({ id: actorId, role: "SUPER_ADMIN" }));
    mockPrismaUnit.findUnique.mockResolvedValue({
      id: "unit-1",
      agentId: null,
      unitCode: "B-202",
    });

    const { updateFinishing } = await import("@/lib/actions/crm");
    const result = await updateFinishing({
      unitId: "unit-1",
      totalFinishingPrice: 250000,
      phases: ["NOT_STARTED"],
    });

    expect(result.success).toBe(true);
    expect(auditRows).toContainEqual({
      userId: actorId,
      tableName: "Finishing",
      action: "UPDATE",
    });
  });

  it("addClientExtraPhone records the acting user for the new phone", async () => {
    const actorId = "community-1";
    mockAuth.mockResolvedValue(session({ id: actorId, role: "COMMUNITY_MANAGEMENT" }));
    mockPrismaUnit.findUnique.mockResolvedValue({
      id: "unit-1",
      deletedAt: null,
      agentId: null,
      project: { id: "proj-jamila", name: "JAMILA NORTH COAST" },
      client: {
        id: "client-1",
        phone1: "0100",
        phone2: null,
        address1: "Street 1",
        address2: null,
        phones: [],
        addresses: [],
      },
    });

    const { addClientExtraPhone } = await import("@/lib/actions/client-contacts");
    const result = await addClientExtraPhone("unit-1", "0111222333");

    expect(result.success).toBe(true);
    expect(auditRows).toContainEqual({
      userId: actorId,
      tableName: "ClientPhone",
      action: "CREATE",
    });
  });
});

describe("notification log", () => {
  it("reads notifications directly without withAudit", async () => {
    const source = await import("@/lib/actions/notification-log");
    expect(source.getNotificationLogRows).toBeDefined();
    expect(String(source.getNotificationLogRows)).not.toContain("withAudit");
  });
});
