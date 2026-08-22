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
import {
  finishingFormSchema,
  type FinishingFormInput,
} from "@/lib/validations/finishing";

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
    prisma.user.delete({ where: { id } })
  );
  revalidatePath("/users");
  return actionOk();
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

  if (!notes.trim()) return actionFail("Notes are required");

  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) return actionFail("Unit not found");

  if (session.user.role === "CS_AGENT" && unit.agentId !== session.user.id) {
    return actionFail("Not assigned to this unit");
  }

  await withAudit(() =>
    prisma.ticket.create({
      data: {
        unitId,
        notes,
        status,
        category: "GENERAL",
        agentId: session.user.id,
      },
    })
  );

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

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { unit: true },
  });
  if (!ticket) return actionFail("Ticket not found");

  if (session.user.role === "CS_AGENT" && ticket.unit.agentId !== session.user.id) {
    return actionFail("Not assigned to this unit");
  }

  await withAudit(() => prisma.ticket.update({ where: { id }, data: { status } }));
  revalidatePath(`/units/${ticket.unitId}`);
  revalidatePath("/cases");
  revalidatePath("/dashboard");
  revalidatePath("/executive");
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
      },
    })
  );

  revalidatePath(`/units/${unitId}`);
  revalidatePath("/units");
  return actionOk();
}
