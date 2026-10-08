"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { assertCsAgentUnitAccess } from "@/lib/auth/abac";
import {
  isAdminUnitManager,
  isCommunityManagementRole,
} from "@/lib/auth/unit-roles";
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
import { auditContext } from "@/lib/prisma";
import {
  createUnitFormSchema,
  unitProfileFormSchema,
  type CreateUnitFormInput,
  type UnitProfileFormInput,
} from "@/lib/validations/unit-profile";

async function requireSession() {
  const session = await auth();
  if (!session?.user) return null;
  return session;
}

async function withAudit<T>(fn: () => Promise<T>) {
  const session = await auth();
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? "unknown";
  return auditContext.run({ userId: session?.user?.id, ipAddress: ip }, fn);
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
  if (isCommunityManagementRole(role)) {
    return actionFail("Unauthorized");
  }
  const isContactEditor = isAdmin || role === "CS_AGENT";

  if (!isContactEditor) {
    return actionFail("Unauthorized");
  }

  const parsed = unitProfileFormSchema.safeParse(input);
  if (!parsed.success) {
    return actionFail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const unit = await prisma.unit.findUnique({
    where: { id: parsed.data.unitId },
    include: { client: true },
  });
  if (!unit || unit.deletedAt) return actionFail("Unit not found");

  if (role === "CS_AGENT") {
    const accessError = await assertCsAgentUnitAccess(session.user, unit.agentId);
    if (accessError) return accessError;
  }

  const {
    unitId,
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
        if (isAdmin) {
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

        let clientId = unit.clientId;
        if (clientId) {
          await tx.client.update({
            where: { id: clientId },
            data: clientData,
          });
        } else {
          const client = await tx.client.create({ data: clientData });
          clientId = client.id;
          await tx.unit.update({
            where: { id: unitId },
            data: { clientId: client.id },
          });
        }

        await syncClientExtraPhones(tx, clientId!, phone1, extraPhones);
        await syncClientExtraAddresses(tx, clientId!, address1, extraAddresses);
      });
    });
  } catch (error) {
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
