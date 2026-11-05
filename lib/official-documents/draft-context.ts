import type { OfficialDocumentType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { activeUnitWhere } from "@/lib/prisma/soft-delete";
import {
  buildOfficialDocumentMergeFields,
  interpolateOfficialDocumentTemplate,
  type UnitMergeInput,
} from "@/lib/official-documents/merge-fields";
import {
  documentTypeMatchesRequest,
  requiredRequestTypeForDocument,
} from "@/lib/official-documents/request-binding";
import { isOfficialDocumentsFeatureEnabledForProject } from "@/lib/official-documents/permissions";

export const OFFICIAL_DOCUMENT_UNIT_INCLUDE = {
  project: true,
  client: {
    include: { phones: true, addresses: true },
  },
  unitClients: {
    orderBy: { position: "asc" as const },
    include: {
      client: { include: { phones: true, addresses: true } },
    },
  },
  contractWorkflow: true,
  finishing: true,
} as const;

export function mapUnitMergeInput(unit: {
  unitCode: string;
  area: number | null;
  gracePeriod: string | null;
  contractPricePerMeter: number | null;
  swapOutgoingUnitCode: string | null;
  swapOutgoingProjectName: string | null;
  swappedFromUnitCode: string | null;
  swappedFromProjectName: string | null;
  project: { name: string };
  client: UnitMergeInput["client"];
  unitClients: UnitMergeInput["unitClients"];
  contractWorkflow: UnitMergeInput["contractWorkflow"];
  finishing: UnitMergeInput["finishing"];
}): UnitMergeInput {
  return {
    unitCode: unit.unitCode,
    area: unit.area,
    gracePeriod: unit.gracePeriod,
    contractPricePerMeter: unit.contractPricePerMeter,
    swapOutgoingUnitCode: unit.swapOutgoingUnitCode,
    swapOutgoingProjectName: unit.swapOutgoingProjectName,
    swappedFromUnitCode: unit.swappedFromUnitCode,
    swappedFromProjectName: unit.swappedFromProjectName,
    project: unit.project,
    client: unit.client,
    unitClients: unit.unitClients,
    contractWorkflow: unit.contractWorkflow,
    finishing: unit.finishing,
  };
}

export async function loadUnitForOfficialDocuments(unitId: string) {
  return prisma.unit.findFirst({
    where: activeUnitWhere({ id: unitId }),
    include: OFFICIAL_DOCUMENT_UNIT_INCLUDE,
  });
}

export async function resolveOfficialDocumentGenerationContext(input: {
  unitId: string;
  documentType: OfficialDocumentType;
  locale: "en" | "ar";
  unitRequestId?: string | null;
}): Promise<
  | {
      ok: true;
      unit: NonNullable<Awaited<ReturnType<typeof loadUnitForOfficialDocuments>>>;
      template: {
        id: string;
        title: string;
        body: string;
        version: number;
        locale: string;
      };
      unitRequestId: string | null;
      requestDescription: string | null;
      mergeUnit: UnitMergeInput;
      initialBody: string;
    }
  | { ok: false; error: string }
> {
  const unit = await loadUnitForOfficialDocuments(input.unitId);
  if (!unit) return { ok: false, error: "Unit not found" };

  if (
    !isOfficialDocumentsFeatureEnabledForProject({
      unitCycleEnabled: unit.project.unitCycleEnabled,
    })
  ) {
    return {
      ok: false,
      error: "Official document generation is not enabled for this project",
    };
  }

  const template = await prisma.officialDocumentTemplate.findFirst({
    where: {
      documentType: input.documentType,
      locale: input.locale,
      isActive: true,
    },
  });
  if (!template) {
    return { ok: false, error: "No active template for this document and language" };
  }

  let requestDescription: string | null = null;
  const unitRequestId: string | null = input.unitRequestId ?? null;
  const requiredType = requiredRequestTypeForDocument(input.documentType);

  if (requiredType) {
    if (!unitRequestId) {
      return { ok: false, error: "An approved request is required for this document type" };
    }
    const request = await prisma.unitRequest.findFirst({
      where: {
        id: unitRequestId,
        unitId: unit.id,
        type: requiredType,
        status: "APPROVED",
      },
    });
    if (!request) {
      return { ok: false, error: "Linked request must be approved before generation" };
    }
    requestDescription = request.description;
  } else if (unitRequestId) {
    const request = await prisma.unitRequest.findFirst({
      where: { id: unitRequestId, unitId: unit.id },
    });
    if (!request) return { ok: false, error: "Request not found for this unit" };
    if (!documentTypeMatchesRequest(input.documentType, request.type)) {
      return { ok: false, error: "Request type does not match this document" };
    }
    requestDescription = request.description;
  }

  const mergeUnit = mapUnitMergeInput(unit);
  const fields = buildOfficialDocumentMergeFields(mergeUnit, input.locale, {
    requestDescription,
  });
  const initialBody = interpolateOfficialDocumentTemplate(template.body, fields);

  return {
    ok: true,
    unit,
    template,
    unitRequestId,
    requestDescription,
    mergeUnit,
    initialBody,
  };
}
