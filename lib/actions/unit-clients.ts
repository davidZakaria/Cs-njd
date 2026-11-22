"use server";

import { Prisma, UnitClientRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { withAudit } from "@/lib/audit/with-audit";
import {
  canAddUnitCoOwner,
  canManageUnitCoOwners,
} from "@/lib/auth/role-permissions";
import { isCommunityManagementRole, isCsAgentRole } from "@/lib/auth/unit-roles";
import { basePrisma, prisma } from "@/lib/prisma";
import { assertClientLinkedToUnit } from "@/lib/units/assert-unit-client-link";
import { getHandoverMergedOwnerConvertHints } from "@/lib/official-documents/handover/unit-owner-resolution";
import { mapUnitMergeInput } from "@/lib/official-documents/draft-context";
import { recordAuditLog } from "@/lib/prisma/record-audit-log";
import { splitMergedOwnerNames } from "@/lib/utils/arabic-normalize";
import { searchDigitVariants } from "@/lib/format/locale-display";
import {
  formatPhoneForDisplay,
  sanitizePhoneForStorage,
} from "@/lib/phone/display";

function optionalTrimmedString() {
  return z
    .union([z.string(), z.literal(""), z.null(), z.undefined()])
    .optional()
    .transform((value) => {
      if (value == null) return null;
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    });
}

function optionalCoOwnerEmail() {
  return z
    .union([z.string(), z.literal(""), z.null(), z.undefined()])
    .optional()
    .transform((value) => {
      if (value == null) return null;
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    })
    .pipe(z.union([z.string().email(), z.null()]));
}

const newCoOwnerSchema = z.object({
  unitId: z.string().min(1),
  mode: z.enum(["new", "link"]),
  name: z.string().optional(),
  nationalId: z.string().optional(),
  phone: z.string().optional(),
  email: optionalCoOwnerEmail(),
  address: optionalTrimmedString(),
  existingClientId: z.string().optional(),
});

export type AddUnitCoOwnerInput = z.input<typeof newCoOwnerSchema>;

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

  const digitVariants = searchDigitVariants(trimmed);
  const phoneClauses = digitVariants.flatMap((variant) => [
    { phone1: { contains: variant } },
    { phones: { some: { phone: { contains: variant } } } },
  ]);

  const clients = await prisma.client.findMany({
    where: {
      deletedAt: null,
      id: { notIn: [...linkedIds] },
      OR: [
        { nationalId: { contains: trimmed } },
        ...digitVariants
          .filter((v) => v !== trimmed)
          .map((variant) => ({ nationalId: { contains: variant } })),
        { name: { contains: trimmed, mode: "insensitive" } },
        ...phoneClauses,
      ],
    },
    take: 8,
    orderBy: { name: "asc" },
    select: { id: true, name: true, nationalId: true, phone1: true },
  });

  return {
    success: true,
    clients: clients.map((client) => ({
      ...client,
      phone1: client.phone1 ? formatPhoneForDisplay(client.phone1) : null,
    })),
  };
}

export async function addUnitCoOwner(
  input: AddUnitCoOwnerInput
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
              phone1: sanitizePhoneForStorage(parsed.data.phone),
              email: parsed.data.email,
              address1: parsed.data.address,
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

const convertMergedHandoverOwnerSchema = z.object({
  unitId: z.string().min(1),
  confirmSplit: z.literal(true),
  coOwnerNationalId: z.string().min(1),
  coOwnerPhone: optionalTrimmedString(),
  coOwnerEmail: optionalCoOwnerEmail(),
  coOwnerAddress: optionalTrimmedString(),
});

export type ConvertMergedHandoverOwnerInput = z.input<
  typeof convertMergedHandoverOwnerSchema
>;

/** Split a merged "/" primary owner name into PRIMARY + CO_OWNER client records (handover). */
export async function convertMergedHandoverOwnerToCoOwner(
  input: ConvertMergedHandoverOwnerInput
): Promise<ActionResult & { coOwnerClientId?: string }> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const parsed = convertMergedHandoverOwnerSchema.safeParse(input);
  if (!parsed.success) {
    return actionFail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { unitId, coOwnerNationalId } = parsed.data;
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      project: { select: { id: true, name: true, unitCycleEnabled: true } },
      client: {
        include: { phones: true, addresses: true },
      },
      unitClients: {
        orderBy: { position: "asc" },
        include: {
          client: { include: { phones: true, addresses: true } },
        },
      },
      contractWorkflow: true,
      finishing: true,
    },
  });
  if (!unit || unit.deletedAt) return actionFail("Unit not found");
  if (!canAddUnitCoOwner(session.user.role, unit.project)) {
    return actionFail("Unauthorized");
  }

  const mergeUnit = mapUnitMergeInput(unit);
  const hints = getHandoverMergedOwnerConvertHints(mergeUnit, unit.clientId);
  if (!hints) {
    return actionFail(
      "This unit does not have a merged primary owner name to split"
    );
  }

  const primaryClient = unit.client;
  if (!primaryClient) return actionFail("Unit has no primary client");

  const parts = splitMergedOwnerNames(primaryClient.name);
  if (parts.length !== 2) {
    return actionFail("Owner name must contain exactly two names separated by /");
  }

  const [owner1Name, owner2Name] = parts;
  const nationalId = coOwnerNationalId.trim();

  let coOwnerClientId: string | undefined;

  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? "unknown";

  try {
    await withAudit(async () => {
      await prisma.$transaction(async (tx) => {
        const existingCoOwners = await tx.unitClient.count({
          where: { unitId, role: UnitClientRole.CO_OWNER },
        });
        if (existingCoOwners > 0) {
          throw new Error("CO_OWNER_EXISTS");
        }

        const maxPosition = await tx.unitClient.aggregate({
          where: { unitId },
          _max: { position: true },
        });
        const nextPosition = (maxPosition._max.position ?? -1) + 1;

        const previousPrimaryName = primaryClient.name;

        await tx.client.update({
          where: { id: primaryClient.id },
          data: { name: owner1Name },
        });

        const coClient = await tx.client.create({
          data: {
            name: owner2Name,
            nationalId,
            phone1: sanitizePhoneForStorage(parsed.data.coOwnerPhone),
            email: parsed.data.coOwnerEmail,
            address1: parsed.data.coOwnerAddress,
          },
        });
        coOwnerClientId = coClient.id;

        const primaryLink = await tx.unitClient.findFirst({
          where: { unitId, clientId: primaryClient.id },
        });
        if (!primaryLink) {
          await tx.unitClient.create({
            data: {
              unitId,
              clientId: primaryClient.id,
              role: UnitClientRole.PRIMARY,
              position: 0,
            },
          });
        } else if (primaryLink.role !== UnitClientRole.PRIMARY) {
          await tx.unitClient.update({
            where: { id: primaryLink.id },
            data: { role: UnitClientRole.PRIMARY, position: 0 },
          });
        }

        await tx.unitClient.create({
          data: {
            unitId,
            clientId: coClient.id,
            role: UnitClientRole.CO_OWNER,
            position: nextPosition,
          },
        });

        await recordAuditLog(
          basePrisma,
          { userId: session.user!.id, ipAddress: ip },
          {
            model: "Unit",
            action: "UPDATE",
            recordId: unitId,
            oldData: {
              primaryClientName: previousPrimaryName,
              mergedHandoverOwnerSplit: false,
            },
            newData: {
              primaryClientName: owner1Name,
              coOwnerClientId: coClient.id,
              coOwnerClientName: owner2Name,
              mergedHandoverOwnerSplit: true,
              action: "convert_merged_handover_owner_to_co_owner",
            },
          }
        );
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CO_OWNER_EXISTS") {
      return actionFail("This unit already has a co-owner record");
    }
    throw error;
  }

  revalidatePath(`/units/${unitId}`);
  revalidatePath("/units");
  return { success: true, coOwnerClientId };
}
