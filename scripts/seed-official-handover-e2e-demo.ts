/**
 * Local demo fixture for official handover UI E2E (fake data only).
 * Requires Postgres + SUPER_ADMIN bootstrap. Writes manifest to AGENT_STORE path.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const AGENT_STORE =
  process.env.HANDOVER_E2E_STORE?.trim() ||
  "/cursor/stores/self/handover-e2e-ui-evidence";

type VariantKey =
  | "green-avenue"
  | "green-avenue-no-insurance"
  | "green-avenue-dual"
  | "green-avenue-dual-no-insurance"
  | "jura"
  | "jura-dual";

async function ensureProject(name: string) {
  return prisma.project.upsert({
    where: { name },
    update: { unitCycleEnabled: true },
    create: { name, unitCycleEnabled: true },
  });
}


function nationalIdForDemoClient(suffix: string): string {
  let h = 0;
  for (const ch of suffix) {
    h = (Math.imul(31, h) + ch.charCodeAt(0)) >>> 0;
  }
  return `290010${String(h % 100_000_000).padStart(8, "0")}`;
}

async function createDemoClient(suffix: string) {
  const nationalId = nationalIdForDemoClient(suffix);
  const email = `demo-owner-${suffix}@example.test`;
  const name = `Demo Owner ${suffix}`;
  const phone1 = "+201555010001";
  const address1 = "12 Demo Street, Cairo";

  const byEmail = await prisma.client.findFirst({ where: { email } });
  if (byEmail) {
    const keepNationalId =
      /^\d{14}$/.test(byEmail.nationalId ?? "") ?
        byEmail.nationalId!
      : nationalId;
    return prisma.client.update({
      where: { id: byEmail.id },
      data: {
        nationalId: keepNationalId,
        name,
        phone1,
        address1,
        email,
      },
    });
  }

  return prisma.client.create({
    data: {
      name,
      nationalId,
      email,
      phone1,
      address1,
      phones: {
        create: [{ phone: phone1, sortOrder: 0 }],
      },
      addresses: {
        create: [{ address: address1, sortOrder: 0 }],
      },
    },
  });
}

async function createUnit(input: {
  projectName: "GREEN AVENUE" | "JURA";
  unitCode: string;
  variant: VariantKey;
  dual: boolean;
  fullyFinished: boolean;
  adminUserId: string;
}) {
  const project = await ensureProject(input.projectName);
  const owner1 = await createDemoClient(`${input.variant}-1`);
  const owner2 = input.dual
    ? await createDemoClient(`${input.variant}-2`)
    : null;

  const existing = await prisma.unit.findFirst({
    where: { projectId: project.id, unitCode: input.unitCode, deletedAt: null },
    include: { project: true, finishing: true },
  });
  if (existing) {
    if (input.projectName === "GREEN AVENUE") {
      const finishingData = input.fullyFinished
        ? {
            finishingType: "FULLY_FINISHED" as const,
            packageType: "PACKAGE_1" as const,
            packageLabel: "Fully Finished",
            totalFinishingPrice: 100,
            pricePerMeter: 1,
          }
        : {
            finishingType: "CORE_AND_SHELL" as const,
            packageType: "CORE_AND_SHELL" as const,
            packageLabel: null,
            totalFinishingPrice: null,
            pricePerMeter: null,
          };
      if (existing.finishing) {
        await prisma.finishing.update({
          where: { unitId: existing.id },
          data: finishingData,
        });
      } else {
        await prisma.finishing.create({
          data: { unitId: existing.id, ...finishingData },
        });
      }
    }
    return { unit: { ...existing, project: existing.project }, variant: input.variant };
  }

  const unit = await prisma.unit.create({
    data: {
      unitCode: input.unitCode,
      projectId: project.id,
      area: 145,
      gracePeriod: "0",
      contractPricePerMeter: 0,
      unitClients: {
        create: [
          { role: "PRIMARY", position: 0, clientId: owner1.id },
          ...(owner2
            ? [{ role: "CO_OWNER" as const, position: 1, clientId: owner2.id }]
            : []),
        ],
      },
      contractWorkflow: {
        create: {
          contractDate: new Date("2025-09-30"),
          deliveryDate: new Date("2026-05-17"),
        },
      },
      finishing:
        input.projectName === "JURA"
          ? undefined
          : {
              create: input.fullyFinished
                ? {
                    finishingType: "FULLY_FINISHED",
                    packageType: "PACKAGE_1",
                    packageLabel: "Fully Finished",
                    totalFinishingPrice: 100,
                    pricePerMeter: 1,
                  }
                : {
                    finishingType: "CORE_AND_SHELL",
                    packageType: "CORE_AND_SHELL",
                    packageLabel: null,
                    totalFinishingPrice: null,
                    pricePerMeter: null,
                  },
            },
    },
    include: { project: true },
  });

  return { unit, variant: input.variant };
}

/** Remove stale UI-test drafts so E2E starts from prepare/create, not corrupted saves. */
async function resetHandoverDraftsOnDemoUnits(unitIds: string[]) {
  const drafts = await prisma.officialDocumentTextDraft.findMany({
    where: {
      unitId: { in: unitIds },
      documentType: "HANDOVER_RECORD",
    },
    select: { id: true },
  });
  const draftIds = drafts.map((d) => d.id);
  if (draftIds.length === 0) return;
  await prisma.unitGeneratedDocument.updateMany({
    where: { textDraftId: { in: draftIds } },
    data: { textDraftId: null },
  });
  await prisma.officialDocumentTextDraftVersion.deleteMany({
    where: { draftId: { in: draftIds } },
  });
  await prisma.officialDocumentTextDraft.deleteMany({
    where: { id: { in: draftIds } },
  });
}

async function seedLegacyEnglishDraft(input: {
  unitId: string;
  adminUserId: string;
}) {
  const enTemplate = await prisma.officialDocumentTemplate.findFirst({
    where: {
      documentType: "HANDOVER_RECORD",
      locale: "en",
      isActive: true,
    },
  });
  if (!enTemplate) {
    throw new Error("Run seed:official-document-templates first");
  }

  const userMarker =
    "USER_EDIT_KEEP: legal note added before official master migration.";
  const body = `Unit Handover Record\n\nProject: GREEN AVENUE\n\n${userMarker}`;

  const existing = await prisma.officialDocumentTextDraft.findFirst({
    where: {
      unitId: input.unitId,
      documentType: "HANDOVER_RECORD",
      templateLocale: "en",
    },
  });
  if (existing) return existing;

  return prisma.$transaction(async (tx) => {
    const draft = await tx.officialDocumentTextDraft.create({
      data: {
        unitId: input.unitId,
        documentType: "HANDOVER_RECORD",
        templateId: enTemplate.id,
        templateVersion: enTemplate.version,
        templateLocale: "en",
        title: enTemplate.title,
        currentBody: body,
        handoverTemplateKey: null,
        createdById: input.adminUserId,
        updatedById: input.adminUserId,
      },
    });
    await tx.officialDocumentTextDraftVersion.create({
      data: {
        draftId: draft.id,
        body,
        editedById: input.adminUserId,
      },
    });
    return draft;
  });
}

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) {
    throw new Error("Bootstrap super admin first (npm run db:bootstrap-admin)");
  }

  const specs: Array<{
    variant: VariantKey;
    projectName: "GREEN AVENUE" | "JURA";
    unitCode: string;
    dual: boolean;
    fullyFinished: boolean;
  }> = [
    {
      variant: "green-avenue",
      projectName: "GREEN AVENUE",
      unitCode: "701-3-B",
      dual: false,
      fullyFinished: false,
    },
    {
      variant: "green-avenue-no-insurance",
      projectName: "GREEN AVENUE",
      unitCode: "702-3-B",
      dual: false,
      fullyFinished: true,
    },
    {
      variant: "green-avenue-dual",
      projectName: "GREEN AVENUE",
      unitCode: "703-3-B",
      dual: true,
      fullyFinished: false,
    },
    {
      variant: "green-avenue-dual-no-insurance",
      projectName: "GREEN AVENUE",
      unitCode: "704-3-B",
      dual: true,
      fullyFinished: true,
    },
    {
      variant: "jura",
      projectName: "JURA",
      unitCode: "801-2-A",
      dual: false,
      fullyFinished: false,
    },
    {
      variant: "jura-dual",
      projectName: "JURA",
      unitCode: "802-2-A",
      dual: true,
      fullyFinished: false,
    },
  ];

  const units: Array<{ variant: VariantKey; unitId: string; unitCode: string }> =
    [];
  for (const spec of specs) {
    const { unit, variant } = await createUnit({
      ...spec,
      adminUserId: admin.id,
    });
    units.push({ variant, unitId: unit.id, unitCode: unit.unitCode });
  }

  await resetHandoverDraftsOnDemoUnits(units.map((u) => u.unitId));

  const legacyUnit = units.find((u) => u.variant === "green-avenue-no-insurance")!;
  const legacyDraft = await seedLegacyEnglishDraft({
    unitId: legacyUnit.unitId,
    adminUserId: admin.id,
  });

  fs.mkdirSync(AGENT_STORE, { recursive: true });
  const manifest = {
    createdAt: new Date().toISOString(),
    loginEmail: process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase(),
    units,
    legacyDraft: {
      unitId: legacyUnit.unitId,
      draftId: legacyDraft.id,
      userEditMarker: "USER_EDIT_KEEP",
    },
  };
  fs.writeFileSync(
    path.join(AGENT_STORE, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );

  const twoFactorSecret = "JBSWY3DPEHPK3PXP";
  await prisma.user.update({
    where: { id: admin.id },
    data: {
      is2FAEnabled: true,
      twoFactorSecret,
      requiresPasswordChange: false,
    },
  });
  fs.writeFileSync(
    path.join(AGENT_STORE, "two-factor-secret.txt"),
    twoFactorSecret
  );

  console.log("Wrote manifest to", path.join(AGENT_STORE, "manifest.json"));
  console.log(JSON.stringify(manifest, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
