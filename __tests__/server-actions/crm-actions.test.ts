import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Role, PendingParty, TicketStatus } from "@prisma/client";

const mockAuth = vi.fn();
const mockPrismaUser = {
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
};
const mockPrismaTicket = {
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};
const mockPrismaUnit = {
  findUnique: vi.fn(),
  update: vi.fn(),
};
const mockPrismaFinishing = {
  upsert: vi.fn(),
};
const mockPrismaContractWorkflow = {
  upsert: vi.fn(),
};

const mockPrisma = {
  user: mockPrismaUser,
  ticket: mockPrismaTicket,
  unit: mockPrismaUnit,
  finishing: mockPrismaFinishing,
  contractWorkflow: mockPrismaContractWorkflow,
};

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
  auditContext: {
    run: <T>(_ctx: unknown, fn: () => T) => fn(),
  },
}));

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve({
    get: () => "127.0.0.1",
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/notifications/dispatch-ticket-notifications", () => ({
  dispatchTicketWorkflowNotifications: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/notifications/triggers", () => ({
  notifyUnitAssigned: vi.fn().mockResolvedValue(undefined),
  notifyFinishingUpdatedByAgent: vi.fn().mockResolvedValue(undefined),
  notifyHandoverChecklistUpdatedByAgent: vi.fn().mockResolvedValue(undefined),
  notifyInboundCall: vi.fn().mockResolvedValue(undefined),
}));

function createMockSession(user: {
  id: string;
  email?: string;
  name?: string;
  role: Role;
} | null) {
  if (!user) return null;
  return {
    user: {
      id: user.id,
      email: user.email ?? "user@test.com",
      name: user.name ?? "Test User",
      role: user.role,
    },
    expires: new Date(Date.now() + 3600 * 1000).toISOString(),
  };
}

function createMockTicket(overrides: Partial<{
  id: string;
  unitId: string;
  agentId: string | null;
  status: TicketStatus;
  pendingParty: PendingParty;
  notes: string;
  unit: { id: string; agentId: string | null; unitCode: string };
}> = {}) {
  return {
    id: overrides.id ?? "ticket-1",
    unitId: overrides.unitId ?? "unit-1",
    agentId: overrides.agentId ?? "agent-1",
    status: overrides.status ?? "PENDING",
    pendingParty: overrides.pendingParty ?? "NONE",
    notes: overrides.notes ?? "Test notes",
    unit: overrides.unit ?? { id: "unit-1", agentId: "agent-1", unitCode: "A-101" },
  };
}

describe("CRM Server Actions - Authentication & RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("assignTicketAgent", () => {
    it("denies access for unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);
      
      const { assignTicketAgent } = await import("@/lib/actions/crm");
      const formData = new FormData();
      formData.set("id", "ticket-1");
      formData.set("agentId", "new-agent-id");
      
      const result = await assignTicketAgent(formData);
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("denies access for CS_AGENT role", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "cs-agent-1",
        role: "CS_AGENT",
      }));
      
      const { assignTicketAgent } = await import("@/lib/actions/crm");
      const formData = new FormData();
      formData.set("id", "ticket-1");
      formData.set("agentId", "new-agent-id");
      
      const result = await assignTicketAgent(formData);
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("denies access for ENGINEER role", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "engineer-1",
        role: "ENGINEER",
      }));
      
      const { assignTicketAgent } = await import("@/lib/actions/crm");
      const formData = new FormData();
      formData.set("id", "ticket-1");
      formData.set("agentId", "new-agent-id");
      
      const result = await assignTicketAgent(formData);
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("allows access for SUPER_ADMIN role", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      const ticket = createMockTicket();
      mockPrismaTicket.findUnique.mockResolvedValue(ticket);
      mockPrismaTicket.update.mockResolvedValue({ ...ticket, agentId: "new-agent-id" });
      mockPrismaUnit.update.mockResolvedValue({ ...ticket.unit, agentId: "new-agent-id" });
      
      const { assignTicketAgent } = await import("@/lib/actions/crm");
      const formData = new FormData();
      formData.set("id", "ticket-1");
      formData.set("agentId", "new-agent-id");
      
      const result = await assignTicketAgent(formData);
      
      expect(result.success).toBe(true);
    });

    it("allows access for MANAGEMENT role", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "management-1",
        role: "MANAGEMENT",
      }));
      
      const ticket = createMockTicket();
      mockPrismaTicket.findUnique.mockResolvedValue(ticket);
      mockPrismaTicket.update.mockResolvedValue({ ...ticket, agentId: "new-agent-id" });
      mockPrismaUnit.update.mockResolvedValue({ ...ticket.unit, agentId: "new-agent-id" });
      
      const { assignTicketAgent } = await import("@/lib/actions/crm");
      const formData = new FormData();
      formData.set("id", "ticket-1");
      formData.set("agentId", "new-agent-id");
      
      const result = await assignTicketAgent(formData);
      
      expect(result.success).toBe(true);
    });

    it("returns error when ticket not found", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      mockPrismaTicket.findUnique.mockResolvedValue(null);
      
      const { assignTicketAgent } = await import("@/lib/actions/crm");
      const formData = new FormData();
      formData.set("id", "nonexistent-ticket");
      formData.set("agentId", "new-agent-id");
      
      const result = await assignTicketAgent(formData);
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Ticket not found");
    });
  });

  describe("updateTicketStatus", () => {
    it("denies access for unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);
      
      const { updateTicketStatus } = await import("@/lib/actions/crm");
      const formData = new FormData();
      formData.set("id", "ticket-1");
      formData.set("status", "ENGINEERING");
      
      const result = await updateTicketStatus(formData);
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("allows CS_AGENT to update their own ticket", async () => {
      const agentId = "cs-agent-1";
      mockAuth.mockResolvedValue(createMockSession({
        id: agentId,
        role: "CS_AGENT",
      }));
      
      const ticket = createMockTicket({
        agentId,
        unit: { id: "unit-1", agentId, unitCode: "A-101" },
      });
      mockPrismaTicket.findUnique.mockResolvedValue(ticket);
      mockPrismaTicket.update.mockResolvedValue({ ...ticket, status: "ENGINEERING" });
      
      const { updateTicketStatus } = await import("@/lib/actions/crm");
      const formData = new FormData();
      formData.set("id", "ticket-1");
      formData.set("status", "ENGINEERING");
      
      const result = await updateTicketStatus(formData);
      
      expect(result.success).toBe(true);
    });

    it("denies CS_AGENT from updating another agent's ticket", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "cs-agent-1",
        role: "CS_AGENT",
      }));
      
      const ticket = createMockTicket({
        agentId: "other-agent",
        unit: { id: "unit-1", agentId: "other-agent", unitCode: "A-101" },
      });
      mockPrismaTicket.findUnique.mockResolvedValue(ticket);
      
      const { updateTicketStatus } = await import("@/lib/actions/crm");
      const formData = new FormData();
      formData.set("id", "ticket-1");
      formData.set("status", "ENGINEERING");
      
      const result = await updateTicketStatus(formData);
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("allows SUPER_ADMIN to update any ticket", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      const ticket = createMockTicket();
      mockPrismaTicket.findUnique.mockResolvedValue(ticket);
      mockPrismaTicket.update.mockResolvedValue({ ...ticket, status: "ENGINEERING" });
      
      const { updateTicketStatus } = await import("@/lib/actions/crm");
      const formData = new FormData();
      formData.set("id", "ticket-1");
      formData.set("status", "ENGINEERING");
      
      const result = await updateTicketStatus(formData);
      
      expect(result.success).toBe(true);
    });

    it("returns error when ticket not found", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      mockPrismaTicket.findUnique.mockResolvedValue(null);
      
      const { updateTicketStatus } = await import("@/lib/actions/crm");
      const formData = new FormData();
      formData.set("id", "nonexistent");
      formData.set("status", "ENGINEERING");
      
      const result = await updateTicketStatus(formData);
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Ticket not found");
    });
  });

  describe("deleteTicket", () => {
    it("denies access for unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);
      
      const { deleteTicket } = await import("@/lib/actions/crm");
      const result = await deleteTicket("ticket-1");
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("denies access for CS_AGENT role", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "cs-agent-1",
        role: "CS_AGENT",
      }));
      
      const { deleteTicket } = await import("@/lib/actions/crm");
      const result = await deleteTicket("ticket-1");
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("denies access for ENGINEER role", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "engineer-1",
        role: "ENGINEER",
      }));
      
      const { deleteTicket } = await import("@/lib/actions/crm");
      const result = await deleteTicket("ticket-1");
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("allows SUPER_ADMIN to delete tickets", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      const ticket = createMockTicket();
      mockPrismaTicket.findUnique.mockResolvedValue(ticket);
      mockPrismaTicket.delete.mockResolvedValue(ticket);
      
      const { deleteTicket } = await import("@/lib/actions/crm");
      const result = await deleteTicket("ticket-1");
      
      expect(result.success).toBe(true);
    });

    it("allows MANAGEMENT to delete tickets", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "management-1",
        role: "MANAGEMENT",
      }));
      
      const ticket = createMockTicket();
      mockPrismaTicket.findUnique.mockResolvedValue(ticket);
      mockPrismaTicket.delete.mockResolvedValue(ticket);
      
      const { deleteTicket } = await import("@/lib/actions/crm");
      const result = await deleteTicket("ticket-1");
      
      expect(result.success).toBe(true);
    });
  });

  describe("reopenUnitTicket", () => {
    it("denies access for unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);
      
      const { reopenUnitTicket } = await import("@/lib/actions/crm");
      const result = await reopenUnitTicket({
        ticketId: "ticket-1",
        reason: "Needs more work",
      });
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("denies access for CS_AGENT role", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "cs-agent-1",
        role: "CS_AGENT",
      }));
      
      const { reopenUnitTicket } = await import("@/lib/actions/crm");
      const result = await reopenUnitTicket({
        ticketId: "ticket-1",
        reason: "Needs more work",
      });
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("allows MANAGEMENT to reopen resolved tickets", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "management-1",
        name: "Manager",
        role: "MANAGEMENT",
      }));
      
      const ticket = createMockTicket({ status: "RESOLVED" });
      mockPrismaTicket.findUnique.mockResolvedValue(ticket);
      mockPrismaTicket.update.mockResolvedValue({ ...ticket, status: "PENDING" });
      
      const { reopenUnitTicket } = await import("@/lib/actions/crm");
      const result = await reopenUnitTicket({
        ticketId: "ticket-1",
        reason: "Needs more work",
      });
      
      expect(result.success).toBe(true);
    });

    it("fails when ticket is not resolved", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "management-1",
        role: "MANAGEMENT",
      }));
      
      const ticket = createMockTicket({ status: "PENDING" });
      mockPrismaTicket.findUnique.mockResolvedValue(ticket);
      
      const { reopenUnitTicket } = await import("@/lib/actions/crm");
      const result = await reopenUnitTicket({
        ticketId: "ticket-1",
        reason: "Needs more work",
      });
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Case is not resolved");
    });

    it("requires a reason for reopening", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "management-1",
        role: "MANAGEMENT",
      }));
      
      const { reopenUnitTicket } = await import("@/lib/actions/crm");
      const result = await reopenUnitTicket({
        ticketId: "ticket-1",
        reason: "   ",
      });
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Reason is required");
    });
  });

  describe("createTicket", () => {
    it("denies access for unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);
      
      const { createTicket } = await import("@/lib/actions/crm");
      const formData = new FormData();
      formData.set("unitId", "unit-1");
      formData.set("notes", "Test notes");
      
      const result = await createTicket(formData);
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("allows authenticated user to create ticket for their unit", async () => {
      const agentId = "cs-agent-1";
      mockAuth.mockResolvedValue(createMockSession({
        id: agentId,
        role: "CS_AGENT",
      }));
      
      const unit = { id: "unit-1", agentId, unitCode: "A-101" };
      mockPrismaUnit.findUnique.mockResolvedValue(unit);
      mockPrismaTicket.create.mockResolvedValue({
        id: "new-ticket",
        unitId: unit.id,
        notes: "Test notes",
        status: "PENDING",
      });
      
      const { createTicket } = await import("@/lib/actions/crm");
      const formData = new FormData();
      formData.set("unitId", "unit-1");
      formData.set("notes", "Test notes");
      
      const result = await createTicket(formData);
      
      expect(result.success).toBe(true);
    });

    it("requires notes for ticket creation", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "cs-agent-1",
        role: "CS_AGENT",
      }));
      
      mockPrismaUnit.findUnique.mockResolvedValue({ id: "unit-1", agentId: "cs-agent-1" });
      
      const { createTicket } = await import("@/lib/actions/crm");
      const formData = new FormData();
      formData.set("unitId", "unit-1");
      formData.set("notes", "   ");
      
      const result = await createTicket(formData);
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Notes are required");
    });

    it("returns error when unit not found", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "cs-agent-1",
        role: "CS_AGENT",
      }));
      
      mockPrismaUnit.findUnique.mockResolvedValue(null);
      
      const { createTicket } = await import("@/lib/actions/crm");
      const formData = new FormData();
      formData.set("unitId", "nonexistent");
      formData.set("notes", "Test notes");
      
      const result = await createTicket(formData);
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unit not found");
    });
  });

  describe("updateHandoverChecklist", () => {
    const validHandoverInput = {
      unitId: "unit-1",
      handoverStatus: "PENDING" as const,
      actionLabel: null,
      contractDate: null,
      deliveryDate: null,
      hasSignedProtocol: false,
      hasSignedExtension: false,
      hasPaidFees: true,
      papersReceived: false,
      powerOfAttorneyReceived: false,
      isLegallyBlocked: false,
      inspectionDate: null,
    };

    it("denies access for unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);
      
      const { updateHandoverChecklist } = await import("@/lib/actions/crm");
      const result = await updateHandoverChecklist(validHandoverInput);
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("denies access for CS_AGENT role", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "cs-agent-1",
        role: "CS_AGENT",
      }));
      
      const { updateHandoverChecklist } = await import("@/lib/actions/crm");
      const result = await updateHandoverChecklist(validHandoverInput);
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("allows SUPER_ADMIN to update handover checklist", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      mockPrismaUnit.findUnique.mockResolvedValue({ id: "unit-1" });
      mockPrismaContractWorkflow.upsert.mockResolvedValue({
        unitId: "unit-1",
        hasPaidFees: true,
      });
      
      const { updateHandoverChecklist } = await import("@/lib/actions/crm");
      const result = await updateHandoverChecklist(validHandoverInput);
      
      expect(result.success).toBe(true);
    });

    it("allows MANAGEMENT to update handover checklist", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "management-1",
        role: "MANAGEMENT",
      }));
      
      mockPrismaUnit.findUnique.mockResolvedValue({ id: "unit-1" });
      mockPrismaContractWorkflow.upsert.mockResolvedValue({
        unitId: "unit-1",
        hasPaidFees: true,
      });
      
      const { updateHandoverChecklist } = await import("@/lib/actions/crm");
      const result = await updateHandoverChecklist(validHandoverInput);
      
      expect(result.success).toBe(true);
    });
  });

  describe("updateFinishing", () => {
    it("denies access for unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);
      
      const { updateFinishing } = await import("@/lib/actions/crm");
      const result = await updateFinishing({
        unitId: "unit-1",
      });
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("denies access for CS_AGENT role", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "cs-agent-1",
        role: "CS_AGENT",
      }));
      
      const { updateFinishing } = await import("@/lib/actions/crm");
      const result = await updateFinishing({
        unitId: "unit-1",
      });
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("allows SUPER_ADMIN to update finishing", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      mockPrismaUnit.findUnique.mockResolvedValue({ id: "unit-1" });
      mockPrismaFinishing.upsert.mockResolvedValue({ unitId: "unit-1" });
      
      const { updateFinishing } = await import("@/lib/actions/crm");
      const result = await updateFinishing({
        unitId: "unit-1",
      });
      
      expect(result.success).toBe(true);
    });
  });
});
