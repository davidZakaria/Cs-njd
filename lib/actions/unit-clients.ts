"use server";

import { Prisma, UnitClientRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { withAudit } from "@/lib/audit/with-audit";
import {
  canAddUnitCoOwner,
  canManageUnitCoOwners,
} from "@/lib/auth/role-permissions";
import { isCommunityManagementRole, isCsAgentRole } from "@/lib/auth/unit-roles";
import { prisma } from "@/lib/prisma";
import { assertClientLinkedToUnit } from "@/lib/units/assert-unit-client-link";

const newCoOwnerSchema = z.object({
  unitId: z.string().min(1),
  mode: z.enum(["new", "link"]),
  name: z.string().optional(),
  nationalId: z.string().optional(),
  phone: z.string().optional(),
  existingClientId: z.string().optional(),
});

async function loadUnitForCoOwnerMutation(unitId: string) {
  return prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      project: { select: { id: true, name: true } },
      unitClients: { select: { id: true, clientId: true, role: true, position: true } },
    },
  });
}

export async function searchClientsForCoOwnerLink(
  unitId: string,
  query: string
): Promise<
  | { success: true; clients: Array<{ id: string; name: string; nationalId: string | null; phone1: string | null }> }
  | { success: false; error: string }
> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const unit = await loadUnitForCoOwnerMutation(unitId);
  if (!unit || unit.deletedAt) return { success: false, error: "Unit not found" };
  if (!canManageUnitCoOwners(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { success: true, clients: [] };
  }

  const linkedIds = new Set(
    unit.unitClients.map((l) => l.clientId).concat(unit.clientId ? [unit.clientId] : [])
  );

  const clients = await prisma.client.findMany({
    where: {
      deletedAt: null,
      id: { notIn: [...linkedIds] },
      OR: [
        { nationalId: { contains: trimmed } },
        { name: { contains: trimmed, mode: "insensitive" } },
        { phone1: { contains: trimmed } },
        { phones: { some: { phone: { contains: trimmed } } } },
      ],
    },
    take: 8,
    orderBy: { name: "asc" },
    select: { id: true, name: true, nationalId: true, phone1: true },
  });

  return { success: true, clients };
}

export async function addUnitCoOwner(
  input: z.infer<typeof newCoOwnerSchema>
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const parsed = newCoOwnerSchema.safeParse(input);
  if (!parsed.success) {
    return actionFail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { unitId, mode } = parsed.data;
  const unit = await loadUnitForCoOwnerMutation(unitId);
  if (!unit || unit.deletedAt) return actionFail("Unit not found");
  if (!canAddUnitCoOwner(session.user.role, unit.project)) {
    return actionFail("Unauthorized");
  }

  if (
    (isCommunityManagementRole(session.user.role) ||
      isCsAgentRole(session.user.role)) &&
    mode === "link"
  ) {
    return actionFail("Unauthorized");
  }

  const maxPosition = unit.unitClients.reduce(
    (max, row) => Math.max(max, row.position),
    -1
  );

  try {
    await withAudit(async () => {
      await prisma.$transaction(async (tx) => {
        let clientId: string;

        if (mode === "link") {
          const existingClientId = parsed.data.existingClientId?.trim();
          if (!existingClientId) {
            throw new Error("CLIENT_REQUIRED");
          }
          const client = await tx.client.findFirst({
            where: { id: existingClientId, deletedAt: null },
          });
          if (!client) throw new Error("CLIENT_NOT_FOUND");
          clientId = client.id;
        } else {
          const name = parsed.data.name?.trim();
          if (!name) throw new Error("NAME_REQUIRED");
          const client = await tx.client.create({
            data: {
              name,
              nationalId: parsed.data.nationalId?.trim() || null,
              phone1: parsed.data.phone?.trim() || null,
            },
          });
          clientId = client.id;
        }

        const duplicate = await tx.unitClient.findUnique({
          where: { unitId_clientId: { unitId, clientId } },
        });
        if (duplicate || unit.clientId === clientId) {
          throw new Error("ALREADY_LINKED");
        }

        await tx.unitClient.create({
          data: {
            unitId,
            clientId,
            role: UnitClientRole.CO_OWNER,
            position: maxPosition + 1,
          },
        });
      });
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "CLIENT_REQUIRED") return actionFail("Client is required");
      if (error.message === "CLIENT_NOT_FOUND") return actionFail("Client not found");
      if (error.message === "NAME_REQUIRED") return actionFail("Name is required");
      if (error.message === "ALREADY_LINKED") {
        return actionFail("This client is already an owner on this unit");
      }
    }
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

export async function removeUnitCoOwner(
  unitId: string,
  clientId: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const unit = await loadUnitForCoOwnerMutation(unitId);
  if (!unit || unit.deletedAt) return actionFail("Unit not found");
  if (!canManageUnitCoOwners(session.user.role)) {
    return actionFail("Unauthorized");
  }

  if (unit.clientId === clientId) {
    return actionFail("Cannot remove the primary owner");
  }

  const link = await prisma.unitClient.findUnique({
    where: { unitId_clientId: { unitId, clientId } },
  });
  if (!link || link.role === UnitClientRole.PRIMARY) {
    return actionFail("Co-owner link not found");
  }

  await withAudit(() =>
    prisma.unitClient.delete({
      where: { unitId_clientId: { unitId, clientId } },
    })
  );

  revalidatePath(`/units/${unitId}`);
  revalidatePath("/units");
  return actionOk();
}

export async function setUnitPrimaryOwner(
  unitId: string,
  clientId: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      project: { select: { id: true, name: true } },
      unitClients: true,
    },
  });
  if (!unit || unit.deletedAt) return actionFail("Unit not found");
  if (!canManageUnitCoOwners(session.user.role)) {
    return actionFail("Unauthorized");
  }

  const linked = await assertClientLinkedToUnit(unitId, clientId);
  if (!linked) return actionFail("Client is not an owner on this unit");

  const previousPrimaryId = unit.clientId;

  await withAudit(async () => {
    await prisma.$transaction(async (tx) => {
      const links = await tx.unitClient.findMany({
        where: { unitId },
        select: { id: true, clientId: true, role: true, position: true },
      });

      const newLink = links.find((l) => l.clientId === clientId);
      const swappedPosition = newLink?.position ?? 0;

      await tx.unit.update({
        where: { id: unitId },
        data: { clientId },
      });

      await tx.unitClient.updateMany({
        where: { unitId, role: UnitClientRole.PRIMARY },
        data: { role: UnitClientRole.CO_OWNER },
      });

      if (newLink) {
        await tx.unitClient.update({
          where: { id: newLink.id },
          data: { role: UnitClientRole.PRIMARY, position: 0 },
        });
      } else {
        await tx.unitClient.create({
          data: {
            unitId,
            clientId,
            role: UnitClientRole.PRIMARY,
            position: 0,
          },
        });
      }

      if (previousPrimaryId && previousPrimaryId !== clientId) {
        const prevLink = links.find((l) => l.clientId === previousPrimaryId);
        if (prevLink) {
          await tx.unitClient.update({
            where: { id: prevLink.id },
            data: {
              role: UnitClientRole.CO_OWNER,
              position: swappedPosition,
            },
          });
        } else {
          await tx.unitClient.create({
            data: {
              unitId,
              clientId: previousPrimaryId,
              role: UnitClientRole.CO_OWNER,
              position: swappedPosition,
            },
          });
        }
      }
    });
  });

  revalidatePath(`/units/${unitId}`);
  revalidatePath("/units");
  return actionOk();
}
