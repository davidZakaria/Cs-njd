"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { assertCommunityUnitAccess } from "@/lib/auth/abac";
import { canEditClientContactsOnUnit } from "@/lib/auth/role-permissions";
import {
  validateCommunityExtraAddressAdd,
  validateCommunityExtraPhoneAdd,
} from "@/lib/auth/community-contact-add";
import {
  isAdminUnitManager,
  isCommunityManagementRole,
} from "@/lib/auth/unit-roles";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { withAudit } from "@/lib/audit/with-audit";
import { prisma } from "@/lib/prisma";

async function loadUnitForContactMutation(unitId: string) {
  return prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      project: { select: { id: true, name: true } },
      client: {
        include: {
          phones: { orderBy: { sortOrder: "asc" } },
          addresses: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
}

async function assertCanAddExtraContact(
  role: string,
  unit: { agentId: string | null }
): Promise<ActionResult | null> {
  if (isAdminUnitManager(role as never)) return null;
  if (isCommunityManagementRole(role as never)) return null;
  if (canEditClientContactsOnUnit(role as never)) {
    return null;
  }
  return actionFail("Unauthorized");
}

export async function addClientExtraPhone(
  unitId: string,
  phone: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const unit = await loadUnitForContactMutation(unitId);
  if (!unit || unit.deletedAt) return actionFail("Unit not found");
  if (!unit.client) return actionFail("Client record not found");

  const communityAccess = await assertCommunityUnitAccess(session.user, unit);
  if (communityAccess) return communityAccess;

  const accessError = await assertCanAddExtraContact(session.user.role, unit);
  if (accessError) return accessError;

  const parsed = validateCommunityExtraPhoneAdd(unit.client, phone);
  if ("success" in parsed) {
    return parsed;
  }

  const maxOrder = unit.client.phones.reduce(
    (max, row) => Math.max(max, row.sortOrder),
    -1
  );

  await withAudit(() =>
    prisma.clientPhone.create({
      data: {
        clientId: unit.client!.id,
        phone: parsed.phone,
        sortOrder: maxOrder + 1,
      },
    })
  );

  revalidatePath(`/units/${unitId}`);
  revalidatePath("/units");
  return actionOk();
}

export async function addClientExtraAddress(
  unitId: string,
  address: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const unit = await loadUnitForContactMutation(unitId);
  if (!unit || unit.deletedAt) return actionFail("Unit not found");
  if (!unit.client) return actionFail("Client record not found");

  const communityAccess = await assertCommunityUnitAccess(session.user, unit);
  if (communityAccess) return communityAccess;

  const accessError = await assertCanAddExtraContact(session.user.role, unit);
  if (accessError) return accessError;

  const parsed = validateCommunityExtraAddressAdd(unit.client, address);
  if ("success" in parsed) {
    return parsed;
  }

  const maxOrder = unit.client.addresses.reduce(
    (max, row) => Math.max(max, row.sortOrder),
    -1
  );

  await withAudit(() =>
    prisma.clientAddress.create({
      data: {
        clientId: unit.client!.id,
        address: parsed.address,
        sortOrder: maxOrder + 1,
      },
    })
  );

  revalidatePath(`/units/${unitId}`);
  revalidatePath("/units");
  return actionOk();
}
