"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { assertCsAgentUnitAccess } from "@/lib/auth/abac";
import {
  validateCommunityExtraAddressAdd,
  validateCommunityExtraPhoneAdd,
} from "@/lib/auth/community-contact-add";
import {
  isAdminUnitManager,
  isCommunityManagementRole,
} from "@/lib/auth/unit-roles";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { auditContext } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";

async function withAudit<T>(fn: () => Promise<T>) {
  const session = await auth();
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? "unknown";
  return auditContext.run({ userId: session?.user?.id, ipAddress: ip }, fn);
}

async function loadUnitForContactMutation(unitId: string) {
  return prisma.unit.findUnique({
    where: { id: unitId },
    include: {
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
  if (role === "CS_AGENT") {
    const session = await auth();
    if (!session?.user) return actionFail("Unauthorized");
    return assertCsAgentUnitAccess(session.user, unit.agentId);
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
