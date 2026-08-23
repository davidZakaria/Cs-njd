"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditContext } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/lib/validations/user";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { archivedUserEmail } from "@/lib/prisma/soft-delete";
import {
  notifyCaseAssigned,
  notifyCaseStatusUpdated,
} from "@/lib/notifications/triggers";
import {
  finishingFormSchema,
  type FinishingFormInput,
} from "@/lib/validations/finishing";
import {
  unitProfileFormSchema,
  type UnitProfileFormInput,
} from "@/lib/validations/unit-profile";
import {
  handoverChecklistSchema,
  ticketWorkflowSchema,
  type HandoverChecklistInput,
  type TicketWorkflowInput,
} from "@/lib/validations/workflow";
import { sortPhases, normalizeFinishingPhases } from "@/lib/finishing/phases";
import {
  evaluateResolutionGates,
  mergeTicketWorkflowFields,
} from "@/lib/workflow/resolution-gates";
import { formatResolutionGateErrors } from "@/lib/workflow/resolution-gate-messages";
import type { PendingParty } from "@prisma/client";

async function withAudit<T>(fn: () => Promise<T>) {
  const session = await auth();
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? "unknown";
  return auditContext.run(
    { userId: session?.user?.id, ipAddress: ip },
    fn
  );
}

export async function createUser(input: CreateUserInput): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || !["SUPER_ADMIN", "MANAGEMENT"].includes(session.user.role)) {
    return actionFail("Unauthorized");
  }

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return actionFail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { name, email, password, role } = parsed.data;

  if (session.user.role === "MANAGEMENT" && role !== "CS_AGENT") {
    return actionFail("Management can only create CS agents");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return actionFail("A user with this email already exists");

  const hashed = await bcrypt.hash(password, 12);

  await withAudit(() =>
    prisma.user.create({
      data: { name, email, password: hashed, role },
    })
  );

  revalidatePath("/users");
  return actionOk();
}

export async function updateUser(input: UpdateUserInput): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || !["SUPER_ADMIN", "MANAGEMENT"].includes(session.user.role)) {
    return actionFail("Unauthorized");
  }

  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) {
    return actionFail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { id, name, email, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return actionFail("User not found");
  if (existing.role === "SUPER_ADMIN" && session.user.role !== "SUPER_ADMIN") {
    return actionFail("Cannot modify super admin");
  }

  if (session.user.role === "MANAGEMENT" && role !== "CS_AGENT") {
    return actionFail("Management can only assign CS agent role");
  }

  if (email !== existing.email) {
    const duplicate = await prisma.user.findUnique({ where: { email } });
    if (duplicate) return actionFail("A user with this email already exists");
  }

  await withAudit(() =>
    prisma.user.update({
      where: { id },
      data: { name, email, role },
    })
  );

  revalidatePath("/users");
  return actionOk();
}

export async function forcePasswordResetByAdmin(
  userId: string
): Promise<ActionResult> {
  const session = await auth();
  if (
    !session?.user ||
    !["SUPER_ADMIN", "MANAGEMENT"].includes(session.user.role)
  ) {
    return actionFail("Unauthorized");
  }

  if (session.user.id === userId) {
    return actionFail("Cannot force password reset on yourself");
  }

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) return actionFail("User not found");
  if (existing.role === "SUPER_ADMIN" && session.user.role !== "SUPER_ADMIN") {
    return actionFail("Cannot modify super admin");
  }

  await withAudit(() =>
    prisma.user.update({
      where: { id: userId },
      data: { requiresPasswordChange: true },
    })
  );

  revalidatePath("/users");
  return actionOk();
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return actionFail("Unauthorized");
  }

  if (session.user.id === id) {
    return actionFail("Cannot delete yourself");
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing || existing.role === "SUPER_ADMIN") {
    return actionFail("Cannot delete this user");
  }

  await withAudit(() =>
    prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        email: archivedUserEmail(id),
        sessionVersion: { increment: 1 },
      },
    })
  );
  revalidatePath("/users");
  return actionOk();
}

async function loadUnitGateContext(unitId: string) {
  return prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      finishing: true,
      contractWorkflow: true,
    },
  });
}

async function assertCanResolveTicket(
  role: string,
  status: string,
  ticket: { pendingParty: PendingParty | null },
  unitId: string
): Promise<ActionResult | null> {
  if (status !== "RESOLVED") return null;
  if (role === "SUPER_ADMIN" || role === "MANAGEMENT") return null;

  const unit = await loadUnitGateContext(unitId);
  if (!unit) return actionFail("Unit not found");

  const failures = evaluateResolutionGates({
    ticket,
    finishing: unit.finishing,
    contractWorkflow: unit.contractWorkflow,
  });

  if (failures.length > 0) {
    return actionFail(await formatResolutionGateErrors(failures));
  }

  return null;
}

function parsePendingParty(value: FormDataEntryValue | null): PendingParty | null {
  if (!value || value === "") return null;
  return String(value) as PendingParty;
}

function parseFollowUpDate(value: FormDataEntryValue | null): Date | null {
  if (!value || value === "") return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function createTicket(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const unitId = String(formData.get("unitId"));
  const notes = String(formData.get("notes") ?? "");
  const status = String(formData.get("status") ?? "PENDING") as
    | "PENDING"
    | "ENGINEERING"
    | "LEGAL"
    | "RESOLVED";
  const pendingParty = parsePendingParty(formData.get("pendingParty"));
  const nextFollowUpDate = parseFollowUpDate(formData.get("nextFollowUpDate"));

  if (!notes.trim()) return actionFail("Notes are required");

  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) return actionFail("Unit not found");

  if (session.user.role === "CS_AGENT" && unit.agentId !== session.user.id) {
    return actionFail("Not assigned to this unit");
  }

  const gateError = await assertCanResolveTicket(
    session.user.role,
    status,
    { pendingParty: pendingParty ?? "NONE" },
    unitId
  );
  if (gateError) return gateError;

  await withAudit(() =>
    prisma.ticket.create({
      data: {
        unitId,
        notes,
        status,
        category: "GENERAL",
        agentId: session.user.id,
        pendingParty: pendingParty ?? "NONE",
        nextFollowUpDate,
      },
    })
  );

  if (status === "LEGAL" || status === "RESOLVED") {
    await notifyCaseStatusUpdated({
      unitCode: unit.unitCode,
      unitId,
      status,
      agentName: session.user.name ?? session.user.email ?? "Agent",
    });
  }

  revalidatePath(`/units/${unitId}`);
  revalidatePath("/cases");
  revalidatePath("/dashboard");
  revalidatePath("/executive");
  return actionOk();
}

export async function updateTicketStatus(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as
    | "PENDING"
    | "ENGINEERING"
    | "LEGAL"
    | "RESOLVED";
  const pendingPartyInput = formData.has("pendingParty")
    ? parsePendingParty(formData.get("pendingParty"))
    : undefined;
  const nextFollowUpInput = formData.has("nextFollowUpDate")
    ? parseFollowUpDate(formData.get("nextFollowUpDate"))
    : undefined;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { unit: true },
  });
  if (!ticket) return actionFail("Ticket not found");

  if (session.user.role === "CS_AGENT" && ticket.unit.agentId !== session.user.id) {
    return actionFail("Not assigned to this unit");
  }

  const mergedWorkflow = mergeTicketWorkflowFields(ticket, {
    pendingParty: pendingPartyInput,
    nextFollowUpDate: nextFollowUpInput,
  });

  const gateError = await assertCanResolveTicket(
    session.user.role,
    status,
    mergedWorkflow,
    ticket.unitId
  );
  if (gateError) return gateError;

  const previousStatus = ticket.status;

  await withAudit(() =>
    prisma.ticket.update({
      where: { id },
      data: {
        status,
        pendingParty: mergedWorkflow.pendingParty,
        nextFollowUpDate: mergedWorkflow.nextFollowUpDate,
      },
    })
  );

  if (
    previousStatus !== status &&
    (status === "LEGAL" || status === "RESOLVED")
  ) {
    await notifyCaseStatusUpdated({
      unitCode: ticket.unit.unitCode,
      unitId: ticket.unitId,
      status,
      agentName: session.user.name ?? session.user.email ?? "Agent",
    });
  }

  revalidatePath(`/units/${ticket.unitId}`);
  revalidatePath("/cases");
  revalidatePath("/dashboard");
  revalidatePath("/executive");
  return actionOk();
}

export async function updateTicketWorkflow(
  input: TicketWorkflowInput
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const parsed = ticketWorkflowSchema.safeParse(input);
  if (!parsed.success) {
    return actionFail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { ticketId, pendingParty, nextFollowUpDate } = parsed.data;

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { unit: true },
  });
  if (!ticket) return actionFail("Ticket not found");

  if (
    session.user.role === "CS_AGENT" &&
    ticket.unit.agentId !== session.user.id
  ) {
    return actionFail("Not assigned to this unit");
  }

  if (ticket.status === "RESOLVED" && pendingParty !== "NONE") {
    const gateError = await assertCanResolveTicket(
      session.user.role,
      "RESOLVED",
      { pendingParty },
      ticket.unitId
    );
    if (gateError) return gateError;
  }

  await withAudit(() =>
    prisma.ticket.update({
      where: { id: ticketId },
      data: { pendingParty, nextFollowUpDate },
    })
  );

  revalidatePath(`/units/${ticket.unitId}`);
  revalidatePath("/cases");
  revalidatePath("/dashboard");
  revalidatePath("/executive");
  return actionOk();
}

export async function updateHandoverChecklist(
  input: HandoverChecklistInput
): Promise<ActionResult> {
  const session = await auth();
  if (
    !session?.user ||
    !["SUPER_ADMIN", "MANAGEMENT"].includes(session.user.role)
  ) {
    return actionFail("Unauthorized");
  }

  const parsed = handoverChecklistSchema.safeParse(input);
  if (!parsed.success) {
    return actionFail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { unitId, ...checklist } = parsed.data;

  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) return actionFail("Unit not found");

  await withAudit(() =>
    prisma.contractWorkflow.upsert({
      where: { unitId },
      update: checklist,
      create: {
        unitId,
        ...checklist,
      },
    })
  );

  revalidatePath(`/units/${unitId}`);
  revalidatePath("/units");
  revalidatePath("/dashboard");
  return actionOk();
}

export async function assignTicketAgent(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || !["SUPER_ADMIN", "MANAGEMENT"].includes(session.user.role)) {
    return actionFail("Unauthorized");
  }

  const id = String(formData.get("id"));
  const agentId = String(formData.get("agentId") ?? "");
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { unit: true },
  });
  if (!ticket) return actionFail("Ticket not found");

  const previousAgentId = ticket.agentId;

  await withAudit(async () => {
    await prisma.ticket.update({
      where: { id },
      data: { agentId: agentId === "unassigned" ? null : agentId },
    });

    if (agentId !== "unassigned") {
      await prisma.unit.update({
        where: { id: ticket.unitId },
        data: { agentId },
      });
    }
  });

  if (
    agentId !== "unassigned" &&
    agentId !== previousAgentId &&
    ["SUPER_ADMIN", "MANAGEMENT"].includes(session.user.role)
  ) {
    await notifyCaseAssigned({
      agentUserId: agentId,
      unitCode: ticket.unit.unitCode,
      unitId: ticket.unitId,
    });
  }

  revalidatePath("/cases");
  revalidatePath(`/units/${ticket.unitId}`);
  revalidatePath("/dashboard");
  revalidatePath("/executive");
  return actionOk();
}

export async function updateFinishing(
  input: FinishingFormInput
): Promise<ActionResult> {
  const session = await auth();
  if (
    !session?.user ||
    !["SUPER_ADMIN", "MANAGEMENT"].includes(session.user.role)
  ) {
    return actionFail("Unauthorized");
  }

  const parsed = finishingFormSchema.safeParse(input);
  if (!parsed.success) {
    return actionFail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { unitId, ...data } = parsed.data;
  const phases = normalizeFinishingPhases(data.phases);
  const legacyPhase = phases.includes("FINISHED")
    ? "FINISHED"
    : sortPhases(phases).at(-1) ?? "NOT_STARTED";

  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) return actionFail("Unit not found");

  await withAudit(() =>
    prisma.finishing.upsert({
      where: { unitId },
      update: {
        packageType: data.packageType,
        executingCompany: data.executingCompany,
        contractDate: data.contractDate,
        datedAt: data.datedAt,
        emailDate: data.emailDate,
        pricePerMeter: data.pricePerMeter,
        totalFinishingPrice: data.totalFinishingPrice,
        doorFees: data.doorFees,
        aluminumFees: data.aluminumFees,
        phases,
        phase: legacyPhase,
        currentFinishingStatus: data.currentFinishingStatus,
      },
      create: {
        unitId,
        packageType: data.packageType,
        executingCompany: data.executingCompany,
        contractDate: data.contractDate,
        datedAt: data.datedAt,
        emailDate: data.emailDate,
        pricePerMeter: data.pricePerMeter,
        totalFinishingPrice: data.totalFinishingPrice,
        doorFees: data.doorFees,
        aluminumFees: data.aluminumFees,
        phases,
        phase: legacyPhase,
        currentFinishingStatus: data.currentFinishingStatus,
      },
    })
  );

  revalidatePath(`/units/${unitId}`);
  revalidatePath("/units");
  return actionOk();
}

export async function updateUnitProfile(
  input: UnitProfileFormInput
): Promise<ActionResult> {
  const session = await auth();
  if (
    !session?.user ||
    !["SUPER_ADMIN", "MANAGEMENT"].includes(session.user.role)
  ) {
    return actionFail("Unauthorized");
  }

  const parsed = unitProfileFormSchema.safeParse(input);
  if (!parsed.success) {
    return actionFail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { unitId, address1, address2, deliveryYear, gracePeriod, contractPricePerMeter, type } =
    parsed.data;

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { client: true },
  });
  if (!unit) return actionFail("Unit not found");

  await withAudit(async () => {
    await prisma.unit.update({
      where: { id: unitId },
      data: { deliveryYear, gracePeriod, contractPricePerMeter, type },
    });

    if (unit.clientId) {
      await prisma.client.update({
        where: { id: unit.clientId },
        data: { address1, address2 },
      });
    }
  });

  revalidatePath(`/units/${unitId}`);
  revalidatePath("/units");
  return actionOk();
}
