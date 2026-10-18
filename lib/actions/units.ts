"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import {
  isAdminUnitManager,
  isCommunityManagementRole,
  isCsAgentRole,
} from "@/lib/auth/unit-roles";
import {
  canEditClientIdentityOnUnit,
  canEditClientPhonesAndAddressesOnUnit,
} from "@/lib/auth/role-permissions";
import { assertClientLinkedToUnit } from "@/lib/units/assert-unit-client-link";
import { UnitClientRole } from "@prisma/client";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import {
  addressesForCreate,
  phonesForCreate,
  syncClientExtraAddresses,
  syncClientExtraPhones,
} from "@/lib/client/sync-contact-extras";
import { normalizeUnitCode } from "@/lib/import/sanitize";
import { prisma } from "@/lib/prisma";
import {
  getAssignableAgentUsers,
  isValidUnitAgentId,
} from "@/lib/units/assignable-agents";
import { withAudit } from "@/lib/audit/with-audit";
import {
  createUnitFormSchema,
  csAgentUnitProfileFormSchema,
  unitProfileFormSchema,
  type CreateUnitFormInput,
  type UnitProfileFormInput,
} from "@/lib/validations/unit-profile";

async function requireSession() {
  const session = await auth();
  if (!session?.user) return null;
  return session;
}

async function resolveUnitAgentId(
  agentId: string | null | undefined
): Promise<string | null> {
  if (!agentId) return null;
  const assignableAgents = await getAssignableAgentUsers();
  return isValidUnitAgentId(agentId, assignableAgents) ? agentId : null;
}

export async function createUnit(input: CreateUnitFormInput): Promise<ActionResult> {
  const session = await requireSession();
  if (!session || !isAdminUnitManager(session.user.role)) {
    return actionFail("Unauthorized");
  }

  const parsed = createUnitFormSchema.safeParse(input);
  if (!parsed.success) {
    return actionFail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const data = parsed.data;
  const unitCode = normalizeUnitCode(data.unitCode);

  const project = await prisma.project.findUnique({
    where: { id: data.projectId },
    select: { id: true },
  });
  if (!project) return actionFail("Project not found");

  const duplicate = await prisma.unit.findUnique({
    where: {
      projectId_unitCode: { projectId: project.id, unitCode },
    },
  });
  if (duplicate) {
    return actionFail("A unit with this code already exists in this project");
  }

  const extraPhoneValues = phonesForCreate(data.phone1, data.phone2, []);
  const extraAddressValues = addressesForCreate(
    data.address1,
    data.address2,
    []
  );

  try {
    await withAudit(async () => {
      await prisma.$transaction(async (tx) => {
        const client = await tx.client.create({
          data: {
            name: data.clientName,
            phone1: data.phone1,
            phone2: null,
            email: data.email,
            nationalId: data.nationalId,
            address1: data.address1,
            address2: null,
          },
        });

        for (let i = 0; i < extraPhoneValues.length; i++) {
          await tx.clientPhone.create({
            data: {
              clientId: client.id,
              phone: extraPhoneValues[i],
              sortOrder: i,
            },
          });
        }
        for (let i = 0; i < extraAddressValues.length; i++) {
          await tx.clientAddress.create({
            data: {
              clientId: client.id,
              address: extraAddressValues[i],
              sortOrder: i,
            },
          });
        }

        const resolvedAgentId = await resolveUnitAgentId(data.agentId);

        const unit = await tx.unit.create({
          data: {
            unitCode,
            projectId: project.id,
            type: data.type,
            area: data.area,
            contractPricePerMeter: data.contractPricePerMeter,
            agentId: resolvedAgentId,
            clientId: client.id,
          },
        });

        await tx.unitClient.create({
          data: {
            unitId: unit.id,
            clientId: client.id,
            role: UnitClientRole.PRIMARY,
            position: 0,
          },
        });

        await tx.contractWorkflow.create({ data: { unitId: unit.id } });
        await tx.finishing.create({ data: { unitId: unit.id } });
      });
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

  revalidatePath("/units");
  return actionOk();
}

export async function updateUnit(input: UnitProfileFormInput): Promise<ActionResult> {
  const session = await requireSession();
  if (!session) return actionFail("Unauthorized");

  const role = session.user.role;
  const isAdmin = isAdminUnitManager(role);
  const isCsAgent = isCsAgentRole(role);
  const isCommunity = isCommunityManagementRole(role);

  if (isCommunity) {
    const communityParsed = unitProfileFormSchema.safeParse(input);
    if (!communityParsed.success) {
      return actionFail(communityParsed.error.issues[0]?.message ?? "Invalid input");
    }
    const { unitId, clientId: communityClientId, clientName, phone1, email, nationalId, address1, extraPhones = [], extraAddresses = [] } =
      communityParsed.data;

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: { project: { select: { id: true, name: true } } },
    });
    if (!unit || unit.deletedAt) return actionFail("Unit not found");
    if (!canEditClientIdentityOnUnit(role, unit.project)) {
      return actionFail("Unauthorized");
    }

    const editClientId = communityClientId?.trim() || unit.clientId;
    if (!editClientId) return actionFail("Client record not found");
    if (!(await assertClientLinkedToUnit(unitId, editClientId))) {
      return actionFail("Client record not found");
    }

    try {
      await withAudit(async () => {
        await prisma.$transaction(async (tx) => {
          await tx.client.update({
            where: { id: editClientId },
            data: {
              name: clientName,
              phone1,
              phone2: null,
              email,
              nationalId,
              address1,
              address2: null,
            },
          });
          await syncClientExtraPhones(tx, editClientId, phone1, extraPhones);
          await syncClientExtraAddresses(
            tx,
            editClientId,
            address1,
            extraAddresses
          );
        });
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

  if (!canEditClientPhonesAndAddressesOnUnit(role)) {
    return actionFail("Unauthorized");
  }

  if (isCsAgent) {
    const csParsed = csAgentUnitProfileFormSchema.safeParse(input);
    if (!csParsed.success) {
      return actionFail(csParsed.error.issues[0]?.message ?? "Invalid input");
    }

    const {
      unitId,
      phone1,
      address1,
      extraPhones = [],
      extraAddresses = [],
    } = csParsed.data;

    const targetClientId = input.clientId?.trim() || undefined;

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: { client: true, project: { select: { id: true, name: true } } },
    });
    if (!unit || unit.deletedAt) return actionFail("Unit not found");

    const clientId = targetClientId ?? unit.clientId;
    if (!clientId) return actionFail("Client record not found");

    const linked = await assertClientLinkedToUnit(unitId, clientId);
    if (!linked) return actionFail("Client record not found");

    const existingClient =
      unit.clientId === clientId
        ? unit.client
        : await prisma.client.findUnique({ where: { id: clientId } });
    if (!existingClient) return actionFail("Client record not found");

    const clientData = {
      name: existingClient.name,
      phone1,
      phone2: null,
      email: existingClient.email,
      nationalId: existingClient.nationalId,
      address1,
      address2: null,
    };

    try {
      await withAudit(async () => {
        await prisma.$transaction(async (tx) => {
          await tx.client.update({
            where: { id: clientId },
            data: clientData,
          });
          await syncClientExtraPhones(tx, clientId, phone1, extraPhones);
          await syncClientExtraAddresses(
            tx,
            clientId,
            address1,
            extraAddresses
          );
        });
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

  const parsed = unitProfileFormSchema.safeParse(input);
  if (!parsed.success) {
    return actionFail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const unit = await prisma.unit.findUnique({
    where: { id: parsed.data.unitId },
    include: { client: true, project: { select: { id: true, name: true } } },
  });
  if (!unit || unit.deletedAt) return actionFail("Unit not found");

  const {
    unitId,
    clientId: targetClientIdInput,
    clientName,
    phone1,
    email,
    nationalId,
    address1,
    deliveryYear,
    gracePeriod,
    contractPricePerMeter,
    type,
    area,
    unitCode,
    agentId,
    extraPhones = [],
    extraAddresses = [],
  } = parsed.data;

  const editClientId = targetClientIdInput?.trim() || unit.clientId;
  if (!editClientId) {
    return actionFail("Client record not found");
  }
  const isPrimaryClient = editClientId === unit.clientId;
  const linked = await assertClientLinkedToUnit(unitId, editClientId);
  if (!linked) return actionFail("Client record not found");

  const canEditIdentity = canEditClientIdentityOnUnit(role, unit.project);
  if (!canEditIdentity && (clientName || email || nationalId)) {
    const existing =
      unit.clientId === editClientId
        ? unit.client
        : await prisma.client.findUnique({ where: { id: editClientId } });
    if (
      existing &&
      (existing.name !== clientName ||
        existing.email !== email ||
        existing.nationalId !== nationalId)
    ) {
      return actionFail("Unauthorized");
    }
  }

  const clientData = {
    name: clientName,
    phone1,
    phone2: null,
    email,
    nationalId,
    address1,
    address2: null,
  };

  try {
    await withAudit(async () => {
      await prisma.$transaction(async (tx) => {
        if (isAdmin && isPrimaryClient) {
          const unitUpdate: Prisma.UnitUpdateInput = {
            deliveryYear,
            gracePeriod,
            contractPricePerMeter,
            type,
            area,
          };

          if (unitCode && normalizeUnitCode(unitCode) !== unit.unitCode) {
            const normalized = normalizeUnitCode(unitCode);
            const clash = await tx.unit.findUnique({
              where: {
                projectId_unitCode: {
                  projectId: unit.projectId,
                  unitCode: normalized,
                },
              },
            });
            if (clash && clash.id !== unitId) {
              throw new Error("DUPLICATE_UNIT_CODE");
            }
            unitUpdate.unitCode = normalized;
          }

          if (agentId !== undefined) {
            const resolvedAgentId = await resolveUnitAgentId(agentId);
            unitUpdate.agent = resolvedAgentId
              ? { connect: { id: resolvedAgentId } }
              : { disconnect: true };
          }

          await tx.unit.update({
            where: { id: unitId },
            data: unitUpdate,
          });
        }

        if (isPrimaryClient) {
          if (unit.clientId) {
            await tx.client.update({
              where: { id: unit.clientId },
              data: clientData,
            });
          } else {
            const client = await tx.client.create({ data: clientData });
            await tx.unit.update({
              where: { id: unitId },
              data: { clientId: client.id },
            });
            await tx.unitClient.create({
              data: {
                unitId,
                clientId: client.id,
                role: UnitClientRole.PRIMARY,
                position: 0,
              },
            });
          }
        } else {
          await tx.client.update({
            where: { id: editClientId },
            data: clientData,
          });
        }

        await syncClientExtraPhones(tx, editClientId, phone1, extraPhones);
        await syncClientExtraAddresses(tx, editClientId, address1, extraAddresses);
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CLIENT_NOT_FOUND") {
      return actionFail("Client record not found");
    }
    if (error instanceof Error && error.message === "DUPLICATE_UNIT_CODE") {
      return actionFail("A unit with this code already exists in this project");
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

export async function deleteUnit(unitId: string): Promise<ActionResult> {
  const session = await requireSession();
  if (!session || !isAdminUnitManager(session.user.role)) {
    return actionFail("Unauthorized");
  }

  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit || unit.deletedAt) return actionFail("Unit not found");

  await withAudit(async () => {
    await prisma.unit.delete({ where: { id: unitId } });
  });

  revalidatePath("/units");
  revalidatePath(`/units/${unitId}`);
  return actionOk();
}
