/**
 * Staging / E2E fake data — never run against production DATABASE_URL.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import {
  FinishingType,
  HandoverStatus,
  PrismaClient,
  Role,
  TicketStatus,
  UnitClientRole,
  UnitRequestStatus,
  UnitRequestType,
  UnitType,
} from "@prisma/client";

import {
  STAGING_E2E_DUAL_UNIT_CODE,
  STAGING_E2E_LEGACY_COOWNER_UNIT_CODE,
  STAGING_E2E_MERGED_SLASH_UNIT_CODE,
  STAGING_USERS,
} from "../lib/staging/credentials";
import {
  resolveStagingPassword,
  resolveStagingTotpSecret,
} from "../lib/staging/e2e-secrets";
import {
  LEGACY_PHONE_ARTIFACTS,
  SPELLING_VARIANT_NAMES,
  mergedSlashClientName,
  shouldUseMergedSlashOwnerShape,
} from "../lib/staging/seed-shapes";

const prisma = new PrismaClient();

const SEED_PROJECTS = [
  { name: "GREEN AVENUE" as const, unitCycleEnabled: true },
  { name: "JURA" as const, unitCycleEnabled: true },
  { name: "JAMILA NORTH COAST" as const, unitCycleEnabled: false },
] as const;

const HANDOVER_STATUSES: HandoverStatus[] = [
  "PENDING",
  "DELIVERY_PROTOCOL",
  "DELIVERY_EXTENSION",
  "FINISHING_CHANGE",
  "UNIT_SWAP",
  "NEW_CONTRACT",
  "WAIVER",
  "CANCELLED",
  "REFUSED_DELIVERY",
  "REFUSED_EXTENSION",
  "INSTALLMENT_STOP_WARNING",
  "DELIVERY_WARNING",
];

const FINISHING_TYPES: FinishingType[] = [
  "CORE_AND_SHELL",
  "SEMI_FINISHED",
  "FULLY_FINISHED",
  "FULLY_FINISHED_AC",
  "COMPANY_PACKAGE",
  "THREE_QUARTER",
  "PLASTER_ONLY",
];

const EN_FIRST = [
  "James",
  "Sarah",
  "Michael",
  "Emily",
  "David",
  "Linda",
  "Robert",
  "Anna",
];
const EN_LAST = [
  "Hassan",
  "Farouk",
  "Nader",
  "Saleh",
  "Ibrahim",
  "Mansour",
  "Khalil",
  "Youssef",
];
const AR_NAMES = [
  "محمد أحمد علي",
  "فاطمة حسن محمود",
  "عمر خالد إبراهيم",
  "نورا سعد عبد الله",
  "يوسف كمال رزق",
  "هدى عماد فؤاد",
  "كريم سامي ناصر",
  "ريم طارق شوقي",
  "أحمد ماهر جمال",
  "سلمى وائل عثمان",
];

function assertStagingDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  const staging = process.env.STAGING === "true";
  const ci =
    process.env.CI === "true" ||
    url.includes("@localhost:5432/test") ||
    url.includes("njd_crm_staging");
  if (!staging && !ci && !process.env.STAGING_RESET) {
    console.warn(
      "Set STAGING=true or run in CI to confirm you are not seeding production."
    );
    if (url.includes("njd_crm?") && !url.includes("staging")) {
      throw new Error(
        "Refusing to seed: DATABASE_URL looks like production (set STAGING=true for staging)."
      );
    }
  }
}

function fakeNationalId(seed: number): string {
  const base = String(29001010000000 + (seed % 89999999));
  return base.padStart(14, "0").slice(0, 14);
}

function pick<T>(items: readonly T[], index: number): T {
  return items[index % items.length]!;
}

async function upsertStagingUsers(passwordHash: string) {
  const byId: Record<string, string> = {};
  for (const key of Object.keys(STAGING_USERS) as Array<
    keyof typeof STAGING_USERS
  >) {
    const spec = STAGING_USERS[key];
    const requires2FA = spec.role !== "ENGINEER";
    const user = await prisma.user.upsert({
      where: { email: spec.email },
      update: {
        name: spec.name,
        password: passwordHash,
        role: spec.role as Role,
        isActive: true,
        requiresPasswordChange: false,
        is2FAEnabled: requires2FA,
        twoFactorSecret: requires2FA ? resolveStagingTotpSecret() : null,
      },
      create: {
        name: spec.name,
        email: spec.email,
        password: passwordHash,
        role: spec.role as Role,
        isActive: true,
        requiresPasswordChange: false,
        is2FAEnabled: requires2FA,
        twoFactorSecret: requires2FA ? resolveStagingTotpSecret() : null,
      },
    });
    byId[key] = user.id;
  }
  return byId;
}

async function ensureProjects() {
  const out: Record<string, string> = {};
  for (const p of SEED_PROJECTS) {
    const row = await prisma.project.upsert({
      where: { name: p.name },
      update: { unitCycleEnabled: p.unitCycleEnabled },
      create: { name: p.name, unitCycleEnabled: p.unitCycleEnabled },
    });
    out[p.name] = row.id;
  }
  return out;
}

async function createClient(
  seed: number,
  useArabic: boolean,
  override?: {
    name?: string;
    phone1?: string | null;
    phone2?: string | null;
    email?: string;
  }
) {
  const name =
    override?.name ??
    (useArabic
      ? pick(AR_NAMES, seed)
      : `${pick(EN_FIRST, seed)} ${pick(EN_LAST, seed + 3)}`);
  const email = override?.email ?? `staging-client-${seed}@fake.njd`;
  const nationalId = fakeNationalId(seed);
  const phone1 =
    override?.phone1 ?? `+2010${String(seed).padStart(8, "0")}`;
  return prisma.client.upsert({
    where: { nationalId },
    update: { name, email, phone1, phone2: override?.phone2 ?? undefined },
    create: {
      name,
      nationalId,
      email,
      phone1,
      phone2: override?.phone2 ?? undefined,
      address1: useArabic ? "القاهرة الجديدة — بيانات تجريبية" : "New Cairo — fake staging address",
    },
  });
}

type OwnerShape =
  | { kind: "legacy-client-only" }
  | { kind: "dual-links"; primaryId: string; coOwnerId: string }
  | { kind: "legacy-plus-co"; primaryId: string; coOwnerId: string };

async function createUnitBundle(input: {
  projectId: string;
  unitCode: string;
  clientId: string;
  agentId: string;
  handoverStatus: HandoverStatus;
  finishingType?: FinishingType;
  ownerShape?: OwnerShape;
  seed: number;
  gracePeriod?: string | null;
  contractPricePerMeter?: number | null;
  skipFinishing?: boolean;
}) {
  const deliveryDate = new Date(2025, (input.seed % 12) + 1, 15);
  const contractDate = new Date(2023, input.seed % 12, 1);
  const gracePeriod =
    input.gracePeriod !== undefined
      ? input.gracePeriod
      : input.seed % 2 === 0
        ? "3 months"
        : "6 months";
  const contractPricePerMeter =
    input.contractPricePerMeter !== undefined
      ? input.contractPricePerMeter
      : input.seed % 11 === 0
        ? 0
        : 15000 + (input.seed % 7000);

  const unit = await prisma.unit.upsert({
    where: {
      projectId_unitCode: { projectId: input.projectId, unitCode: input.unitCode },
    },
    update: {
      clientId: input.clientId,
      agentId: input.agentId,
      gracePeriod,
      contractPricePerMeter,
      deliveryYear: String(2024 + (input.seed % 3)),
      type: pick(
        ["APARTMENT", "DUPLEX", "PENTHOUSE", "COMMERCIAL"] as UnitType[],
        input.seed
      ),
      area: 80 + (input.seed % 120),
    },
    create: {
      unitCode: input.unitCode,
      projectId: input.projectId,
      clientId: input.clientId,
      agentId: input.agentId,
      gracePeriod,
      contractPricePerMeter,
      deliveryYear: String(2024 + (input.seed % 3)),
      type: pick(
        ["APARTMENT", "DUPLEX", "PENTHOUSE", "COMMERCIAL"] as UnitType[],
        input.seed
      ),
      area: 80 + (input.seed % 120),
    },
  });

  await prisma.contractWorkflow.upsert({
    where: { unitId: unit.id },
    update: {
      handoverStatus: input.handoverStatus,
      contractDate,
      deliveryDate,
      actionLabel: `Staging action ${input.seed}`,
    },
    create: {
      unitId: unit.id,
      handoverStatus: input.handoverStatus,
      contractDate,
      deliveryDate,
      actionLabel: `Staging action ${input.seed}`,
      hasPaidFees: input.seed % 3 === 0,
      papersReceived: input.seed % 5 === 0,
    },
  });

  if (input.skipFinishing) {
    await prisma.finishing.deleteMany({ where: { unitId: unit.id } });
  } else if (input.finishingType) {
    await prisma.finishing.upsert({
      where: { unitId: unit.id },
      update: { finishingType: input.finishingType },
      create: {
        unitId: unit.id,
        finishingType: input.finishingType,
        totalFinishingPrice: 50000 + input.seed * 100,
        pricePerMeter: 2000 + (input.seed % 500),
      },
    });
  }

  await prisma.unitClient.deleteMany({ where: { unitId: unit.id } });
  const shape = input.ownerShape ?? { kind: "legacy-client-only" as const };
  if (shape.kind === "dual-links" || shape.kind === "legacy-plus-co") {
    await prisma.unitClient.createMany({
      data: [
        {
          unitId: unit.id,
          clientId: shape.primaryId,
          role: UnitClientRole.PRIMARY,
          position: 0,
        },
        {
          unitId: unit.id,
          clientId: shape.coOwnerId,
          role: UnitClientRole.CO_OWNER,
          position: 1,
        },
      ],
    });
  }

  return unit;
}

async function seedUnitsAndClients(userIds: Record<string, string>) {
  const projectIds = await ensureProjects();
  const csAgentId = userIds.csAgent!;
  const unitsCreated: string[] = [];
  let clientSeed = 1;

  const counts = [
    { project: "GREEN AVENUE", prefix: "GA", total: 140 },
    { project: "JURA", prefix: "JR", total: 90 },
    { project: "JAMILA NORTH COAST", prefix: "JM", total: 80 },
  ] as const;

  let globalIndex = 0;
  let mergedSlashCount = 0;
  for (const block of counts) {
    const projectId = projectIds[block.project]!;
    for (let i = 1; i <= block.total; i += 1) {
      const unitCode = `${block.prefix}-${String(i).padStart(3, "0")}`;
      const phones = pick(LEGACY_PHONE_ARTIFACTS, globalIndex);
      const zeroGrace = globalIndex % 13 === 0;
      const skipFinishing = globalIndex % 17 === 0;

      if (shouldUseMergedSlashOwnerShape(globalIndex)) {
        mergedSlashCount += 1;
        const merged = await createClient(clientSeed, true, {
          name: mergedSlashClientName(mergedSlashCount),
          phone1: phones.phone1,
          phone2: phones.phone2,
        });
        clientSeed += 1;
        const unit = await createUnitBundle({
          projectId,
          unitCode,
          clientId: merged.id,
          agentId: csAgentId,
          handoverStatus: pick(HANDOVER_STATUSES, globalIndex),
          finishingType: pick(FINISHING_TYPES, globalIndex),
          ownerShape: { kind: "legacy-client-only" },
          gracePeriod: zeroGrace ? "0" : globalIndex % 2 === 0 ? "3 months" : "6 months",
          contractPricePerMeter: globalIndex % 11 === 0 ? 0 : undefined,
          skipFinishing,
          seed: globalIndex,
        });
        unitsCreated.push(unit.id);
        globalIndex += 1;
        continue;
      }

      const client = await createClient(clientSeed, clientSeed % 3 !== 0, {
        phone1: globalIndex % 5 === 0 ? phones.phone1 : undefined,
        phone2: globalIndex % 7 === 0 ? phones.phone2 : undefined,
      });
      clientSeed += 1;
      const unit = await createUnitBundle({
        projectId,
        unitCode,
        clientId: client.id,
        agentId: csAgentId,
        handoverStatus: pick(HANDOVER_STATUSES, globalIndex),
        finishingType: pick(FINISHING_TYPES, globalIndex),
        gracePeriod: zeroGrace ? "0" : undefined,
        contractPricePerMeter: globalIndex % 11 === 0 ? 0 : undefined,
        skipFinishing,
        seed: globalIndex,
      });
      unitsCreated.push(unit.id);
      globalIndex += 1;
    }
  }

  for (let v = 0; v < SPELLING_VARIANT_NAMES.length; v += 1) {
    const pair = SPELLING_VARIANT_NAMES[v]!;
    const c1 = await createClient(50_000 + v * 2, true, { name: pair.canonical });
    const c2 = await createClient(50_000 + v * 2 + 1, true, {
      name: pair.variant,
      email: `staging-variant-${v}@fake.njd`,
    });
    await createUnitBundle({
      projectId: projectIds["JURA"]!,
      unitCode: `VAR-${String(v + 1).padStart(2, "0")}A`,
      clientId: c1.id,
      agentId: csAgentId,
      handoverStatus: "PENDING",
      finishingType: "SEMI_FINISHED",
      seed: 51_000 + v,
    });
    await createUnitBundle({
      projectId: projectIds["JURA"]!,
      unitCode: `VAR-${String(v + 1).padStart(2, "0")}B`,
      clientId: c2.id,
      agentId: csAgentId,
      handoverStatus: "DELIVERY_PROTOCOL",
      finishingType: "FULLY_FINISHED",
      seed: 52_000 + v,
    });
    void c1;
    void c2;
  }

  const multiUnitClientIds: string[] = [];
  for (let m = 0; m < 12; m += 1) {
    const owner = await createClient(10_000 + m, m % 2 === 0);
    multiUnitClientIds.push(owner.id);
    const extraCodes = [
      `MU-${String(m + 1).padStart(2, "0")}A`,
      `MU-${String(m + 1).padStart(2, "0")}B`,
    ];
    for (const code of extraCodes) {
      await createUnitBundle({
        projectId: projectIds["GREEN AVENUE"]!,
        unitCode: code,
        clientId: owner.id,
        agentId: csAgentId,
        handoverStatus: "DELIVERY_PROTOCOL",
        finishingType: "FULLY_FINISHED",
        seed: 20_000 + m,
      });
    }
  }

  const dualUnits: string[] = [];
  for (let d = 0; d < 12; d += 1) {
    const primary = await createClient(30_000 + d * 2, false);
    const coOwner = await createClient(30_000 + d * 2 + 1, true);
    const unitCode =
      d === 0 ? STAGING_E2E_DUAL_UNIT_CODE : `STAGING-DUAL-${String(d + 1).padStart(2, "0")}`;
    const unit = await createUnitBundle({
      projectId: projectIds["GREEN AVENUE"]!,
      unitCode,
      clientId: primary.id,
      agentId: csAgentId,
      handoverStatus: "DELIVERY_PROTOCOL",
      finishingType: "FULLY_FINISHED_AC",
      ownerShape: { kind: "dual-links", primaryId: primary.id, coOwnerId: coOwner.id },
      seed: 40_000 + d,
    });
    dualUnits.push(unit.id);
  }

  const mergedPhones = LEGACY_PHONE_ARTIFACTS[0]!;
  const mergedE2eClient = await createClient(60_001, true, {
    name: mergedSlashClientName(0),
    phone1: mergedPhones.phone1,
    phone2: mergedPhones.phone2,
  });
  const mergedE2eUnit = await createUnitBundle({
    projectId: projectIds["GREEN AVENUE"]!,
    unitCode: STAGING_E2E_MERGED_SLASH_UNIT_CODE,
    clientId: mergedE2eClient.id,
    agentId: csAgentId,
    handoverStatus: "DELIVERY_PROTOCOL",
    finishingType: "FULLY_FINISHED",
    ownerShape: { kind: "legacy-client-only" },
    gracePeriod: "0",
    contractPricePerMeter: 0,
    seed: 60_001,
  });

  const legacyPrimary = await createClient(60_010, false, {
    name: "Staging Legacy Primary",
    phone1: "96599034830.0",
  });
  const legacyCo = await createClient(60_011, true, {
    name: "سلمى وائل عثمان",
    phone2: "0096551774292",
  });
  const legacyCoUnit = await createUnitBundle({
    projectId: projectIds["GREEN AVENUE"]!,
    unitCode: STAGING_E2E_LEGACY_COOWNER_UNIT_CODE,
    clientId: legacyPrimary.id,
    agentId: csAgentId,
    handoverStatus: "DELIVERY_PROTOCOL",
    finishingType: "COMPANY_PACKAGE",
    ownerShape: {
      kind: "legacy-plus-co",
      primaryId: legacyPrimary.id,
      coOwnerId: legacyCo.id,
    },
    skipFinishing: false,
    seed: 60_010,
  });

  return {
    projectIds,
    csAgentId,
    e2eDualUnitId: dualUnits[0]!,
    e2eMergedSlashUnitId: mergedE2eUnit.id,
    e2eLegacyCoOwnerUnitId: legacyCoUnit.id,
    sampleUnitId: unitsCreated[0]!,
    multiUnitClientIds,
    mergedSlashBulkCount: mergedSlashCount,
  };
}

async function seedRequestsAndCases(input: {
  csAgentId: string;
  supervisorId: string;
  e2eDualUnitId: string;
  sampleUnitId: string;
}) {
  const statuses: UnitRequestStatus[] = [
    "DRAFT",
    "PENDING",
    "APPROVED",
    "REJECTED",
    "CANCELLED",
  ];
  for (let i = 0; i < statuses.length; i += 1) {
    const status = statuses[i]!;
    await prisma.unitRequest.create({
      data: {
        type: UnitRequestType.HANDOVER_APPOINTMENT,
        unitId: input.sampleUnitId,
        requestedById: input.csAgentId,
        status,
        description: `Seeded handover request (${status}) #${i + 1}`,
        submittedAt: status !== "DRAFT" ? new Date() : undefined,
        currentApproverKind: status === "PENDING" ? "CS_AGENT" : undefined,
        resolvedAt:
          status === "APPROVED" || status === "REJECTED" || status === "CANCELLED"
            ? new Date()
            : undefined,
        resolvedById:
          status === "APPROVED" || status === "REJECTED" || status === "CANCELLED"
            ? input.supervisorId
            : undefined,
      },
    });
  }

  const ticketStatuses: TicketStatus[] = [
    "PENDING",
    "ENGINEERING",
    "LEGAL",
    "RESOLVED",
  ];
  for (let t = 0; t < ticketStatuses.length; t += 1) {
    const status = ticketStatuses[t]!;
    await prisma.ticket.create({
      data: {
        unitId: input.sampleUnitId,
        agentId: input.csAgentId,
        createdById: input.csAgentId,
        status,
        category: t % 2 === 0 ? "CUSTOMER_SERVICE" : "GENERAL",
        notes:
          t === 0
            ? "📞 Answered — staging call log for E2E"
            : `Staging case note (${status}) #${t + 1}`,
        pendingParty: "NONE",
      },
    });
  }

  await prisma.ticket.create({
    data: {
      unitId: input.e2eDualUnitId,
      agentId: input.csAgentId,
      createdById: input.csAgentId,
      status: "PENDING",
      category: "CUSTOMER_SERVICE",
      notes: "Staging dual-owner unit case for handover E2E",
      pendingParty: "CLIENT",
    },
  });
}

async function main() {
  assertStagingDatabase();
  const passwordHash = await bcrypt.hash(resolveStagingPassword(), 12);
  const userIds = await upsertStagingUsers(passwordHash);
  const bundle = await seedUnitsAndClients(userIds);
  await seedRequestsAndCases({
    csAgentId: bundle.csAgentId,
    supervisorId: userIds.supervisor!,
    e2eDualUnitId: bundle.e2eDualUnitId,
    sampleUnitId: bundle.sampleUnitId,
  });

  console.log("Staging fake data seed complete.");
  console.log("Merged '/' owner units (bulk):", bundle.mergedSlashBulkCount);
  console.log("E2E unit codes:", {
    mergedSlash: STAGING_E2E_MERGED_SLASH_UNIT_CODE,
    legacyCoOwner: STAGING_E2E_LEGACY_COOWNER_UNIT_CODE,
    twoUnitClients: STAGING_E2E_DUAL_UNIT_CODE,
  });
  console.log(
    "Staff auth: set STAGING_E2E_PASSWORD and STAGING_TOTP_SECRET in .env (not printed)."
  );
  console.log("Users:", JSON.stringify(STAGING_USERS, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());