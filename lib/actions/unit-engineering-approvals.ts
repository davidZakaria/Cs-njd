"use server";

import { FinishingPhase } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import {
  canApproveEngineeringSiteVisitOnUnit,
  canApproveEngineeringSnagDefectOnUnit,
  canEnterEngineeringDataOnUnit,
  canSignOffEngineeringReadinessOnUnit,
} from "@/lib/auth/role-permissions";
import { withAudit } from "@/lib/audit/with-audit";
import {
  normalizeFinishingPhases,
  selectAllEngineeringPhases,
  sortPhases,
} from "@/lib/finishing/phases";
import { prisma } from "@/lib/prisma";
import { applyDhlSiteVisitLock } from "@/lib/workflow/handover-dhl-gate";
import { applyCsFinishingAdditions } from "@/lib/workflow/cs-finishing-fields";
import { recordUnitEngineeringApproval } from "@/lib/workflow/engineering-approval-log";

function optionalDate() {
  return z
    .union([z.string(), z.date(), z.null()])
    .optional()
    .transform((value) => {
      if (value == null || value === "") return null;
      const date = value instanceof Date ? value : new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    });
}

const siteVisitApprovalSchema = z.object({
  unitId: z.string().min(1),
  siteVisitDone: z.boolean(),
  siteVisitDate1: optionalDate(),
  siteVisitDate2: optionalDate(),
  siteVisitDate3: optionalDate(),
});

const snagDefectSchema = z.object({
  unitId: z.string().min(1),
  note: z.string().optional(),
});

const readinessSchema = z.object({
  unitId: z.string().min(1),
  note: z.string().optional(),
});

const dataEntrySchema = z.object({
  unitId: z.string().min(1),
  phases: z.array(z.nativeEnum(FinishingPhase)).min(1),
  addFinishingNote: z.string().optional(),
  addCustomModification: z.string().optional(),
});

function requireEngineeringApprovalRole(
  role: string | undefined,
  check: (role: import("@prisma/client").Role) => boolean
): ActionResult | null {
  if (!role || !check(role as import("@prisma/client").Role)) {
    return actionFail("Unauthorized");
  }
  return null;
}

export async function approveEngineeringSiteVisitAction(
  input: z.input<typeof siteVisitApprovalSchema>
): Promise<ActionResult> {
  const session = await auth();
  const denied = requireEngineeringApprovalRole(
    session?.user.role,
    canApproveEngineeringSiteVisitOnUnit
  );
  if (denied) return denied;
  if (!session?.user) return actionFail("Unauthorized");

  const parsed = siteVisitApprovalSchema.safeParse(input);
  if (!parsed.success) {
    return actionFail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const unit = await prisma.unit.findUnique({
    where: { id: parsed.data.unitId },
    include: { contractWorkflow: true },
  });
  if (!unit) return actionFail("Unit not found");

  const existing = unit.contractWorkflow;
  const wasDone = existing?.siteVisitDone ?? false;
  const dhlSnapshot = existing
    ? {
        siteVisitDone: existing.siteVisitDone,
        dhlSentToClient: existing.dhlSentToClient,
        dhlSentToClientDate: existing.dhlSentToClientDate,
        dhlReceivedFromClient: existing.dhlReceivedFromClient,
        dhlReceivedFromClientDate: existing.dhlReceivedFromClientDate,
        powerOfAttorneyReceived: existing.powerOfAttorneyReceived,
      }
    : null;
  const dhlLocked = applyDhlSiteVisitLock(
    {
      siteVisitDone: parsed.data.siteVisitDone,
      dhlSentToClient: existing?.dhlSentToClient ?? false,
      dhlSentToClientDate: existing?.dhlSentToClientDate ?? null,
      dhlReceivedFromClient: existing?.dhlReceivedFromClient ?? false,
      dhlReceivedFromClientDate: existing?.dhlReceivedFromClientDate ?? null,
      powerOfAttorneyReceived: existing?.powerOfAttorneyReceived ?? false,
    },
    dhlSnapshot
  );
  const locked = {
    ...dhlLocked,
    siteVisitDate1: parsed.data.siteVisitDate1,
    siteVisitDate2: parsed.data.siteVisitDate2,
    siteVisitDate3: parsed.data.siteVisitDate3,
  };

  await withAudit(() =>
    prisma.contractWorkflow.upsert({
      where: { unitId: unit.id },
      update: locked,
      create: {
        unitId: unit.id,
        handoverStatus: "PENDING",
        hasPaidFees: false,
        isLegallyBlocked: false,
        ...locked,
      },
    })
  );

  if (locked.siteVisitDone && !wasDone) {
    await recordUnitEngineeringApproval({
      unitId: unit.id,
      kind: "SITE_VISIT_COMPLETION",
      approvedById: session.user.id,
      summary: "Site visit marked complete",
      payload: {
        siteVisitDate1: locked.siteVisitDate1,
        siteVisitDate2: locked.siteVisitDate2,
        siteVisitDate3: locked.siteVisitDate3,
      },
    });
  }

  revalidatePath(`/units/${unit.id}`);
  revalidatePath("/operations");
  revalidatePath(`/operations/units/${unit.id}`);
  return actionOk();
}

export async function approveEngineeringSnagDefectAction(
  input: z.infer<typeof snagDefectSchema>
): Promise<ActionResult> {
  const session = await auth();
  const denied = requireEngineeringApprovalRole(
    session?.user.role,
    canApproveEngineeringSnagDefectOnUnit
  );
  if (denied) return denied;
  if (!session?.user) return actionFail("Unauthorized");

  const parsed = snagDefectSchema.safeParse(input);
  if (!parsed.success) {
    return actionFail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const unit = await prisma.unit.findUnique({
    where: { id: parsed.data.unitId },
    include: { finishing: true },
  });
  if (!unit) return actionFail("Unit not found");

  const mods = unit.finishing?.customModifications?.trim();
  if (!mods) {
    return actionFail("No custom modifications / snag list on this unit");
  }
  if (unit.finishing?.modificationsCompleted) {
    return actionOk();
  }

  await withAudit(() =>
    prisma.finishing.upsert({
      where: { unitId: unit.id },
      create: {
        unitId: unit.id,
        modificationsCompleted: true,
        phases: ["NOT_STARTED"],
        phase: "NOT_STARTED",
      },
      update: { modificationsCompleted: true },
    })
  );

  await recordUnitEngineeringApproval({
    unitId: unit.id,
    kind: "SNAG_DEFECT_CLOSURE",
    approvedById: session.user.id,
    summary: parsed.data.note?.trim() || "Snag / defect work marked complete",
  });

  revalidatePath(`/units/${unit.id}`);
  return actionOk();
}

export async function signOffEngineeringReadinessAction(
  input: z.infer<typeof readinessSchema>
): Promise<ActionResult> {
  const session = await auth();
  const denied = requireEngineeringApprovalRole(
    session?.user.role,
    canSignOffEngineeringReadinessOnUnit
  );
  if (denied) return denied;
  if (!session?.user) return actionFail("Unauthorized");

  const parsed = readinessSchema.safeParse(input);
  if (!parsed.success) {
    return actionFail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const phases = selectAllEngineeringPhases();
  const legacyPhase = sortPhases(phases).at(-1) ?? "NOT_STARTED";

  const unit = await prisma.unit.findUnique({
    where: { id: parsed.data.unitId },
    select: { id: true },
  });
  if (!unit) return actionFail("Unit not found");

  await withAudit(() =>
    prisma.finishing.upsert({
      where: { unitId: unit.id },
      create: {
        unitId: unit.id,
        phases,
        phase: legacyPhase,
      },
      update: {
        phases,
        phase: legacyPhase,
      },
    })
  );

  await recordUnitEngineeringApproval({
    unitId: unit.id,
    kind: "READINESS_SIGN_OFF",
    approvedById: session.user.id,
    summary: parsed.data.note?.trim() || "Engineering readiness signed off",
    payload: { phases },
  });

  revalidatePath(`/units/${unit.id}`);
  revalidatePath("/executive");
  return actionOk();
}

export async function saveEngineeringDataEntryAction(
  input: z.infer<typeof dataEntrySchema>
): Promise<ActionResult> {
  const session = await auth();
  const denied = requireEngineeringApprovalRole(
    session?.user.role,
    canEnterEngineeringDataOnUnit
  );
  if (denied) return denied;
  if (!session?.user) return actionFail("Unauthorized");

  const parsed = dataEntrySchema.safeParse(input);
  if (!parsed.success) {
    return actionFail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const phases = normalizeFinishingPhases(parsed.data.phases);
  const legacyPhase = sortPhases(phases).at(-1) ?? "NOT_STARTED";

  const unit = await prisma.unit.findUnique({
    where: { id: parsed.data.unitId },
    include: { finishing: true },
  });
  if (!unit) return actionFail("Unit not found");

  const previous = {
    currentFinishingStatus: unit.finishing?.currentFinishingStatus ?? null,
    customModifications: unit.finishing?.customModifications ?? null,
  };
  const { next, changes } = applyCsFinishingAdditions(previous, {
    addFinishingNote: parsed.data.addFinishingNote,
    addCustomModification: parsed.data.addCustomModification,
  });

  await withAudit(() =>
    prisma.finishing.upsert({
      where: { unitId: unit.id },
      create: {
        unitId: unit.id,
        phases,
        phase: legacyPhase,
        currentFinishingStatus: next.currentFinishingStatus,
        customModifications: next.customModifications,
        modificationsCompleted: next.customModifications ? false : true,
      },
      update: {
        phases,
        phase: legacyPhase,
        currentFinishingStatus: next.currentFinishingStatus,
        customModifications: next.customModifications,
        modificationsCompleted:
          next.customModifications != null
            ? unit.finishing?.modificationsCompleted ?? false
            : true,
      },
    })
  );

  await recordUnitEngineeringApproval({
    unitId: unit.id,
    kind: "DATA_ENTRY",
    approvedById: session.user.id,
    summary:
      changes.length > 0
        ? changes.join("; ")
        : "Engineering phase checklist updated",
    payload: { phases },
  });

  revalidatePath(`/units/${unit.id}`);
  revalidatePath("/engineering");
  return actionOk();
}
