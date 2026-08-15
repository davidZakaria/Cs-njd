"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditContext } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";

async function withAudit<T>(fn: () => Promise<T>) {
  const session = await auth();
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? "unknown";
  return auditContext.run(
    { userId: session?.user?.id, ipAddress: ip },
    fn
  );
}

export async function createUser(formData: FormData) {
  const session = await auth();
  if (!session?.user || !["SUPER_ADMIN", "MANAGEMENT"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const name = String(formData.get("name") ?? "");
  const email = String(formData.get("email") ?? "").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "CS_AGENT") as Role;

  if (session.user.role === "MANAGEMENT" && role !== "CS_AGENT") {
    throw new Error("Management can only create CS agents");
  }

  const hashed = await bcrypt.hash(password, 12);

  await withAudit(() =>
    prisma.user.create({
      data: { name, email, password: hashed, role },
    })
  );

  revalidatePath("/users");
}

export async function updateUser(formData: FormData) {
  const session = await auth();
  if (!session?.user || !["SUPER_ADMIN", "MANAGEMENT"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "");
  const role = String(formData.get("role") ?? "CS_AGENT") as Role;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new Error("User not found");
  if (existing.role === "SUPER_ADMIN" && session.user.role !== "SUPER_ADMIN") {
    throw new Error("Cannot modify super admin");
  }

  await withAudit(() =>
    prisma.user.update({
      where: { id },
      data: { name, role },
    })
  );

  revalidatePath("/users");
}

export async function deleteUser(id: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Unauthorized");
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing || existing.role === "SUPER_ADMIN") {
    throw new Error("Cannot delete this user");
  }

  await prisma.user.delete({ where: { id } });
  revalidatePath("/users");
}

export async function createTicket(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const unitId = String(formData.get("unitId"));
  const notes = String(formData.get("notes") ?? "");
  const status = String(formData.get("status") ?? "PENDING") as
    | "PENDING"
    | "ENGINEERING"
    | "LEGAL"
    | "RESOLVED";

  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) throw new Error("Unit not found");

  if (session.user.role === "CS_AGENT" && unit.agentId !== session.user.id) {
    throw new Error("Not assigned to this unit");
  }

  await prisma.ticket.create({
    data: {
      unitId,
      notes,
      status,
      category: "GENERAL",
      agentId: session.user.id,
    },
  });

  revalidatePath(`/units/${unitId}`);
  revalidatePath("/cases");
  revalidatePath("/dashboard");
}

export async function updateTicketStatus(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

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
  if (!ticket) throw new Error("Ticket not found");

  if (session.user.role === "CS_AGENT" && ticket.unit.agentId !== session.user.id) {
    throw new Error("Not assigned to this unit");
  }

  await prisma.ticket.update({ where: { id }, data: { status } });
  revalidatePath(`/units/${ticket.unitId}`);
  revalidatePath("/cases");
  revalidatePath("/dashboard");
}

export async function assignTicketAgent(formData: FormData) {
  const session = await auth();
  if (!session?.user || !["SUPER_ADMIN", "MANAGEMENT"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const id = String(formData.get("id"));
  const agentId = String(formData.get("agentId") ?? "");
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { unit: true },
  });
  if (!ticket) throw new Error("Ticket not found");

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

  revalidatePath("/cases");
  revalidatePath(`/units/${ticket.unitId}`);
  revalidatePath("/dashboard");
}
