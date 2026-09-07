"use server";

import { auth } from "@/lib/auth";
import {
  assertCsAgentCanMutateTicket,
  assertCsAgentUnitAccess,
} from "@/lib/auth/abac";
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
import { dispatchTicketWorkflowNotifications } from "@/lib/notifications/dispatch-ticket-notifications";
import {
  finishingFormSchema,
  csFinishingAdditionsSchema,
  type FinishingFormInput,
  type CsFinishingAdditionsInput,
} from "@/lib/validations/finishing";
import {
  unitProfileFormSchema,
  type UnitProfileFormInput,
} from "@/lib/validations/unit-profile";
import {
  handoverChecklistSchema,
  csHandoverChecklistSchema,
  ticketWorkflowSchema,
  type HandoverChecklistInput,
  type CsHandoverChecklistInput,
  type TicketWorkflowInput,
} from "@/lib/validations/workflow";
import { collectCsHandoverChanges } from "@/lib/workflow/cs-handover-fields";
import { applyCsFinishingAdditions } from "@/lib/workflow/cs-finishing-fields";
import {
  notifyFinishingUpdatedByAgent,
  notifyHandoverChecklistUpdatedByAgent,
  notifyInboundCall,
  notifyUnitAssigned,
} from "@/lib/notifications/triggers";
import { sortPhases, normalizeFinishingPhases } from "@/lib/finishing/phases";
import {
  evaluateResolutionGates,
  mergeTicketWorkflowFields,
} from "@/lib/workflow/resolution-gates";
import { formatResolutionGateErrors } from "@/lib/workflow/resolution-gate-messages";
import { canUseManagementOverride } from "@/lib/workflow/management-override";
import { canManageUnitTickets } from "@/lib/auth/unit-ticket-access";
import {
  TICKET_CATEGORIES,
  ticketManageSchema,
} from "@/lib/validations/ticket";
import { Prisma, type PendingParty, type Role, type TicketCategory } from "@prisma/client";
import { resolvedAtForStatusChange } from "@/lib/tickets/resolved-at";

async function withAudit<T>(fn: () => Promise<T>) {
  const session = await auth();
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? "unknown";
  return auditContext.run(
    { userId: session?.user?.id, ipAddress: ip },
    fn
  );
}

async function assertSingleEngineerAccount(
  excludeUserId?: string
): Promise<ActionResult | null> {
  const engineerCount = await prisma.user.count({
    where: {
      role: "ENGINEER",
      deletedAt: null,
      ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
    },
  });

  if (engineerCount > 0) {
    return actionFail(
      "Only one shared site engineer account is allowed. Edit or remove the existing engineer first."
    );
  }

  return null;
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

  if (session.user.role === "MANAGEMENT" && role !== "CS_AGENT" && role !== "ENGINEER") {
    return actionFail("Management can only create CS agents or site engineers");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return actionFail("A user with this email already exists");

  if (role === "ENGINEER") {
    const engineerLimit = await assertSingleEngineerAccount();
    if (engineerLimit) return engineerLimit;
  }

  const hashed = await bcrypt.hash(password, 12);

  await withAudit(() =>
    prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role,
        ...(role === "ENGINEER"
          ? { is2FAEnabled: false, twoFactorSecret: null }
          : {}),
      },
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

  if (session.user.role === "MANAGEMENT" && role !== "CS_AGENT" && role !== "ENGINEER") {
    return actionFail("Management can only assign CS agent or site engineer role");
  }

  if (email !== existing.email) {
    const duplicate = await prisma.user.findUnique({ where: { email } });
    if (duplicate) return actionFail("A user with this email already exists");
  }

  if (role === "ENGINEER" && existing.role !== "ENGINEER") {
    const engineerLimit = await assertSingleEngineerAccount(existing.id);
    if (engineerLimit) return engineerLimit;
  }

  await withAudit(() =>
    prisma.user.update({
      where: { id },
      data: {
        name,
        email,
        role,
        ...(role === "ENGINEER"
          ? { is2FAEnabled: false, twoFactorSecret: null }
          : {}),
      },
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

function parseTicketCategory(value: FormDataEntryValue | null): TicketCategory {
  const raw = String(value ?? "GENERAL");
  if (
    (TICKET_CATEGORIES as readonly string[]).includes(raw)
  ) {
    return raw as TicketCategory;
  }
  return "GENERAL";
}

function revalidateTicketPaths(unitId: string) {
  revalidatePath(`/units/${unitId}`);
  revalidatePath("/cases");
  revalidatePath("/dashboard");
  revalidatePath("/executive");
}

async function assertCanManageUnitTickets(
  user: { role: Role }
): Promise<ActionResult | null> {
  if (!canManageUnitTickets(user)) {
    return actionFail("Unauthorized");
  }
  return null;
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
  user: { role: Role; email?: string | null },
  status: string,
  ticket: { pendingParty: PendingParty | null },
  unitId: string,
  options?: { managementOverride?: boolean }
): Promise<ActionResult | null> {
  if (status !== "RESOLVED") return null;
  if (user.role === "SUPER_ADMIN") return null;

  const unit = await loadUnitGateContext(unitId);
  if (!unit) return actionFail("Unit not found");

  const failures = evaluateResolutionGates({
    ticket,
    finishing: unit.finishing,
    contractWorkflow: unit.contractWorkflow,
  });

  if (failures.length === 0) return null;

  if (options?.managementOverride && canUseManagementOverride(user)) {
    return null;
  }

  if (failures.length > 0) {
    return actionFail(await formatResolutionGateErrors(failures));
  }

  return null;
}

function parseManagementOverride(value: FormDataEntryValue | null): boolean {
  return value === "true" || value === "on" || value === "1";
}

function managementOverrideNote(agentName: string): string {
  return `[Management override by ${agentName}]`;
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
  const managementOverride = parseManagementOverride(
    formData.get("managementOverride")
  );
  const category = canManageUnitTickets(session.user)
    ? parseTicketCategory(formData.get("category"))
    : "GENERAL";

  if (!notes.trim()) return actionFail("Notes are required");

  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) return actionFail("Unit not found");

  const accessError = await assertCsAgentUnitAccess(session.user, unit.agentId);
  if (accessError) return accessError;

  const gateError = await assertCanResolveTicket(
    session.user,
    status,
    { pendingParty: pendingParty ?? "NONE" },
    unitId,
    { managementOverride }
  );
  if (gateError) return gateError;

  const noteBody =
    managementOverride && status === "RESOLVED"
      ? `${managementOverrideNote(session.user.name ?? session.user.email ?? "Manager")}\n${notes}`
      : notes;

  await withAudit(() =>
    prisma.ticket.create({
      data: {
        unitId,
        notes: noteBody,
        status,
        category,
        agentId: session.user.id,
        pendingParty: pendingParty ?? "NONE",
        nextFollowUpDate,
        ...(status === "RESOLVED" ? { resolvedAt: new Date() } : {}),
      },
    })
  );

  await dispatchTicketWorkflowNotifications({
    unit,
    previousStatus: "PENDING",
    previousPendingParty: "NONE",
    nextStatus: status,
    nextPendingParty: pendingParty ?? "NONE",
    managementOverride: managementOverride ?? false,
    actorName: session.user.name ?? session.user.email ?? "Agent",
  });

  revalidateTicketPaths(unitId);
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
  const managementOverride = parseManagementOverride(
    formData.get("managementOverride")
  );

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { unit: true },
  });
  if (!ticket) return actionFail("Ticket not found");

  const accessError = await assertCsAgentCanMutateTicket(session.user, ticket);
  if (accessError) return accessError;

  const mergedWorkflow = mergeTicketWorkflowFields(ticket, {
    pendingParty: pendingPartyInput,
    nextFollowUpDate: nextFollowUpInput,
  });

  const gateError = await assertCanResolveTicket(
    session.user,
    status,
    mergedWorkflow,
    ticket.unitId,
    { managementOverride }
  );
  if (gateError) return gateError;

  const previousStatus = ticket.status;
  const noteSuffix =
    managementOverride && status === "RESOLVED"
      ? `\n${managementOverrideNote(session.user.name ?? session.user.email ?? "Manager")}`
      : "";
  const nextNotes = noteSuffix ? `${ticket.notes}${noteSuffix}` : ticket.notes;
  const nextResolvedAt = resolvedAtForStatusChange(previousStatus, status);

  await withAudit(() =>
    prisma.ticket.update({
      where: { id },
      data: {
        status,
        notes: nextNotes,
        pendingParty: mergedWorkflow.pendingParty,
        nextFollowUpDate: mergedWorkflow.nextFollowUpDate,
        ...(nextResolvedAt !== undefined ? { resolvedAt: nextResolvedAt } : {}),
      },
    })
  );

  await dispatchTicketWorkflowNotifications({
    unit: ticket.unit,
    previousStatus: ticket.status,
    previousPendingParty: ticket.pendingParty,
    nextStatus: status,
    nextPendingParty: mergedWorkflow.pendingParty,
    managementOverride: managementOverride ?? false,
    actorName: session.user.name ?? session.user.email ?? "Agent",
  });

  revalidateTicketPaths(ticket.unitId);
  return actionOk();
}

export async function updateTicketDetails(
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const authError = await assertCanManageUnitTickets(session.user);
  if (authError) return authError;

  const parsed = ticketManageSchema.safeParse({
    id: String(formData.get("id")),
    notes: String(formData.get("notes") ?? ""),
    status: String(formData.get("status")),
    category: String(formData.get("category")),
    pendingParty: formData.has("pendingParty")
      ? String(formData.get("pendingParty"))
      : undefined,
    nextFollowUpDate: formData.has("nextFollowUpDate")
      ? String(formData.get("nextFollowUpDate"))
      : undefined,
    managementOverride: parseManagementOverride(
      formData.get("managementOverride")
    ),
  });

  if (!parsed.success) {
    return actionFail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const {
    id,
    notes,
    status,
    category,
    pendingParty,
    nextFollowUpDate,
    managementOverride,
  } = parsed.data;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { unit: true },
  });
  if (!ticket) return actionFail("Ticket not found");

  const mergedWorkflow = mergeTicketWorkflowFields(ticket, {
    pendingParty: pendingParty ?? ticket.pendingParty,
    nextFollowUpDate,
  });

  const gateError = await assertCanResolveTicket(
    session.user,
    status,
    mergedWorkflow,
    ticket.unitId,
    { managementOverride }
  );
  if (gateError) return gateError;

  const previousStatus = ticket.status;
  let nextNotes = notes.trim();
  if (
    managementOverride &&
    status === "RESOLVED" &&
    !nextNotes.includes("[Management override")
  ) {
    nextNotes = `${nextNotes}\n${managementOverrideNote(session.user.name ?? session.user.email ?? "Manager")}`;
  }
  const nextResolvedAt = resolvedAtForStatusChange(previousStatus, status);

  await withAudit(() =>
    prisma.ticket.update({
      where: { id },
      data: {
        notes: nextNotes,
        status,
        category,
        pendingParty: mergedWorkflow.pendingParty,
        nextFollowUpDate: mergedWorkflow.nextFollowUpDate,
        ...(nextResolvedAt !== undefined ? { resolvedAt: nextResolvedAt } : {}),
      },
    })
  );

  await dispatchTicketWorkflowNotifications({
    unit: ticket.unit,
    previousStatus: ticket.status,
    previousPendingParty: ticket.pendingParty,
    nextStatus: status,
    nextPendingParty: mergedWorkflow.pendingParty,
    managementOverride: managementOverride ?? false,
    actorName: session.user.name ?? session.user.email ?? "Manager",
  });

  revalidateTicketPaths(ticket.unitId);
  return actionOk();
}

export async function resolveUnitTicket(input: {
  ticketId: string;
  finalNote?: string;
  managementOverride?: boolean;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const ticket = await prisma.ticket.findUnique({
    where: { id: input.ticketId },
    include: { unit: true },
  });
  if (!ticket) return actionFail("Ticket not found");
  if (ticket.status === "RESOLVED") {
    return actionFail("Case is already resolved");
  }

  const accessError = await assertCsAgentCanMutateTicket(session.user, ticket);
  if (accessError) return accessError;

  const managementOverride = input.managementOverride ?? false;
  const mergedWorkflow = mergeTicketWorkflowFields(ticket, {});

  const gateError = await assertCanResolveTicket(
    session.user,
    "RESOLVED",
    mergedWorkflow,
    ticket.unitId,
    { managementOverride }
  );
  if (gateError) return gateError;

  const actorName =
    session.user.name ?? session.user.email ?? "Agent";
  const noteParts: string[] = [ticket.notes];

  if (input.finalNote?.trim()) {
    noteParts.push(input.finalNote.trim());
  }
  if (managementOverride) {
    noteParts.push(managementOverrideNote(actorName));
  }

  const nextNotes = noteParts.join("\n");
  const nextResolvedAt = resolvedAtForStatusChange(ticket.status, "RESOLVED");

  await withAudit(() =>
    prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: "RESOLVED",
        notes: nextNotes,
        pendingParty: "NONE",
        ...(nextResolvedAt !== undefined ? { resolvedAt: nextResolvedAt } : {}),
      },
    })
  );

  await dispatchTicketWorkflowNotifications({
    unit: ticket.unit,
    previousStatus: ticket.status,
    previousPendingParty: ticket.pendingParty,
    nextStatus: "RESOLVED",
    nextPendingParty: "NONE",
    managementOverride,
    actorName,
  });

  revalidateTicketPaths(ticket.unitId);
  return actionOk();
}

function reopenCaseNote(actorName: string, reason: string): string {
  return `[Case reopened by ${actorName}]\n${reason.trim()}`;
}

export async function reopenUnitTicket(input: {
  ticketId: string;
  reason: string;
  targetStatus?: "PENDING" | "ENGINEERING" | "LEGAL";
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const authError = await assertCanManageUnitTickets(session.user);
  if (authError) return authError;

  const reason = input.reason.trim();
  if (!reason) return actionFail("Reason is required");

  const targetStatus = input.targetStatus ?? "PENDING";

  const ticket = await prisma.ticket.findUnique({
    where: { id: input.ticketId },
    include: { unit: true },
  });
  if (!ticket) return actionFail("Ticket not found");
  if (ticket.status !== "RESOLVED") {
    return actionFail("Case is not resolved");
  }

  const actorName =
    session.user.name ?? session.user.email ?? "Management";
  const nextNotes = `${ticket.notes}\n${reopenCaseNote(actorName, reason)}`;
  const nextResolvedAt = resolvedAtForStatusChange(ticket.status, targetStatus);

  await withAudit(() =>
    prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: targetStatus,
        notes: nextNotes,
        pendingParty: targetStatus === "ENGINEERING" ? "ENGINEERING" : "NONE",
        ...(nextResolvedAt !== undefined ? { resolvedAt: nextResolvedAt } : {}),
      },
    })
  );

  revalidateTicketPaths(ticket.unitId);
  return actionOk();
}

export async function deleteTicket(ticketId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const authError = await assertCanManageUnitTickets(session.user);
  if (authError) return authError;

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { unit: true },
  });
  if (!ticket) return actionFail("Ticket not found");

  await withAudit(() => prisma.ticket.delete({ where: { id: ticketId } }));

  revalidateTicketPaths(ticket.unitId);
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

  const accessError = await assertCsAgentCanMutateTicket(session.user, ticket);
  if (accessError) return accessError;

  if (ticket.status === "RESOLVED" && pendingParty !== "NONE") {
    const gateError = await assertCanResolveTicket(
      session.user,
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

  await dispatchTicketWorkflowNotifications({
    unit: ticket.unit,
    previousStatus: ticket.status,
    previousPendingParty: ticket.pendingParty,
    nextStatus: ticket.status,
    nextPendingParty: pendingParty,
    managementOverride: false,
    actorName: session.user.name ?? session.user.email ?? "Agent",
  });

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

  const { unitId, ...workflowData } = parsed.data;

  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) return actionFail("Unit not found");

  await withAudit(() =>
    prisma.contractWorkflow.upsert({
      where: { unitId },
      update: workflowData,
      create: {
        unitId,
        ...workflowData,
      },
    })
  );

  revalidatePath(`/units/${unitId}`);
  revalidatePath("/units");
  revalidatePath("/dashboard");
  return actionOk();
}

export async function updateCsHandoverChecklist(
  input: CsHandoverChecklistInput
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const parsed = csHandoverChecklistSchema.safeParse(input);
  if (!parsed.success) {
    return actionFail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const unit = await prisma.unit.findUnique({
    where: { id: parsed.data.unitId },
    include: { contractWorkflow: true },
  });
  if (!unit) return actionFail("Unit not found");

  const accessError = await assertCsAgentUnitAccess(session.user, unit.agentId);
  if (accessError) return accessError;

  const existing = unit.contractWorkflow;
  const previousSnapshot = {
    hasSignedProtocol: existing?.hasSignedProtocol ?? false,
    hasSignedExtension: existing?.hasSignedExtension ?? false,
    papersReceived: existing?.papersReceived ?? false,
    powerOfAttorneyReceived: existing?.powerOfAttorneyReceived ?? false,
    inspectionDate: existing?.inspectionDate ?? null,
  };

  const { unitId, ...workflowData } = parsed.data;
  const changes = collectCsHandoverChanges(previousSnapshot, workflowData);
  if (changes.length === 0) {
    return actionOk();
  }

  await withAudit(() =>
    prisma.contractWorkflow.upsert({
      where: { unitId },
      update: workflowData,
      create: {
        unitId,
        handoverStatus: "PENDING",
        hasPaidFees: false,
        isLegallyBlocked: false,
        ...workflowData,
      },
    })
  );

  await notifyHandoverChecklistUpdatedByAgent({
    unitCode: unit.unitCode,
    unitId: unit.id,
    agentName: session.user.name ?? session.user.email ?? "CS Agent",
    changesSummary: changes.join("; "),
  });

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

  const previousUnitAgentId = ticket.unit.agentId;

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
    agentId !== previousUnitAgentId
  ) {
    await notifyUnitAssigned({
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

  const { unitId, deliveryDate, ...data } = parsed.data;
  const phases = normalizeFinishingPhases(data.phases);
  const legacyPhase = sortPhases(phases).at(-1) ?? "NOT_STARTED";

  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) return actionFail("Unit not found");

  await withAudit(async () => {
    await prisma.finishing.upsert({
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
        customModifications: data.customModifications,
        modificationsCompleted: data.customModifications
          ? data.modificationsCompleted
          : true,
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
        customModifications: data.customModifications,
        modificationsCompleted: data.customModifications
          ? data.modificationsCompleted
          : true,
      },
    });

    if (deliveryDate !== undefined) {
      await prisma.contractWorkflow.upsert({
        where: { unitId },
        update: { deliveryDate },
        create: { unitId, deliveryDate },
      });
    }
  });

  revalidatePath(`/units/${unitId}`);
  revalidatePath("/units");
  return actionOk();
}

export async function updateCsFinishingAdditions(
  input: CsFinishingAdditionsInput
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const parsed = csFinishingAdditionsSchema.safeParse(input);
  if (!parsed.success) {
    return actionFail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const hasAddition =
    Boolean(parsed.data.addFinishingNote?.trim()) ||
    Boolean(parsed.data.addCustomModification?.trim());
  if (!hasAddition) {
    return actionFail("Nothing to add");
  }

  const unit = await prisma.unit.findUnique({
    where: { id: parsed.data.unitId },
    include: { finishing: true },
  });
  if (!unit) return actionFail("Unit not found");

  const accessError = await assertCsAgentUnitAccess(session.user, unit.agentId);
  if (accessError) return accessError;

  const previous = {
    currentFinishingStatus: unit.finishing?.currentFinishingStatus ?? null,
    customModifications: unit.finishing?.customModifications ?? null,
  };

  const { next, changes } = applyCsFinishingAdditions(previous, parsed.data);
  if (changes.length === 0) {
    return actionOk();
  }

  await withAudit(() =>
    prisma.finishing.upsert({
      where: { unitId: unit.id },
      update: {
        currentFinishingStatus: next.currentFinishingStatus,
        customModifications: next.customModifications,
        modificationsCompleted:
          next.customModifications != null
            ? unit.finishing?.modificationsCompleted ?? false
            : true,
      },
      create: {
        unitId: unit.id,
        currentFinishingStatus: next.currentFinishingStatus,
        customModifications: next.customModifications,
        modificationsCompleted: next.customModifications != null ? false : true,
        phases: ["NOT_STARTED"],
        phase: "NOT_STARTED",
      },
    })
  );

  await notifyFinishingUpdatedByAgent({
    unitCode: unit.unitCode,
    unitId: unit.id,
    agentName: session.user.name ?? session.user.email ?? "CS Agent",
    changesSummary: changes.join("; "),
  });

  revalidatePath(`/units/${unit.id}`);
  revalidatePath("/units");
  revalidatePath("/dashboard");
  return actionOk();
}

export async function logCallQuickAction(input: {
  unitId: string;
  notes: string;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const notes = input.notes.trim();
  if (!notes) return actionFail("Notes are required");

  const unit = await prisma.unit.findUnique({
    where: { id: input.unitId },
    include: { agent: true },
  });
  if (!unit) return actionFail("Unit not found");

  await withAudit(() =>
    prisma.ticket.create({
      data: {
        unitId: unit.id,
        notes,
        status: "PENDING",
        category: "FEEDBACK_HISTORY",
        agentId: session.user.id,
        pendingParty: "NONE",
      },
    })
  );

  if (unit.agentId && unit.agentId !== session.user.id) {
    await notifyInboundCall({
      agentUserId: unit.agentId,
      unitCode: unit.unitCode,
      unitId: unit.id,
      callerName: session.user.name ?? session.user.email ?? "Agent",
    });
  }

  revalidatePath(`/units/${unit.id}`);
  revalidatePath("/cases");
  revalidatePath("/dashboard");
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

  const {
    unitId,
    clientName,
    phone1,
    phone2,
    email,
    nationalId,
    address1,
    address2,
    deliveryYear,
    gracePeriod,
    contractPricePerMeter,
    type,
    area,
  } = parsed.data;

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { client: true },
  });
  if (!unit) return actionFail("Unit not found");

  try {
    await withAudit(async () => {
      await prisma.unit.update({
        where: { id: unitId },
        data: { deliveryYear, gracePeriod, contractPricePerMeter, type, area },
      });

      const clientData = {
        name: clientName,
        phone1,
        phone2,
        email,
        nationalId,
        address1,
        address2,
      };

      if (unit.clientId) {
        await prisma.client.update({
          where: { id: unit.clientId },
          data: clientData,
        });
      } else {
        const client = await prisma.client.create({ data: clientData });
        await prisma.unit.update({
          where: { id: unitId },
          data: { clientId: client.id },
        });
      }
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      Array.isArray(error.meta?.target) &&
      error.meta.target.includes("nationalId")
    ) {
      return actionFail("A client with this national ID already exists");
    }
    throw error;
  }

  revalidatePath(`/units/${unitId}`);
  revalidatePath("/units");
  return actionOk();
}
