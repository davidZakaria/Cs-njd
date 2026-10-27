/**
 * Local demo only — seeds two units for unit-swap UI verification.
 * Usage: npx tsx scripts/demo-unit-swap-seed.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const project =
    (await prisma.project.findFirst({ where: { name: { contains: "GREEN" } } })) ??
    (await prisma.project.findFirst());
  if (!project) {
    throw new Error("No project found — import or create a project first.");
  }

  const stamp = Date.now().toString().slice(-6);
  const sourceCode = `SWAP-SRC-${stamp}`;
  const targetCode = `SWAP-TGT-${stamp}`;

  const client = await prisma.client.create({
    data: {
      name: `Swap Demo Client ${stamp}`,
      phone1: `0100${stamp}`,
      nationalId: `2990101${stamp}`.slice(0, 14),
    },
  });

  const source = await prisma.unit.create({
    data: {
      unitCode: sourceCode,
      projectId: project.id,
      clientId: client.id,
      gracePeriod: "6 months",
      contractWorkflow: {
        create: {
          hasPreliminarySaleContract: true,
          hasSignedExtension: true,
          signedContractFile: `demo-${stamp}.pdf`,
          extensionAnnexFile: `demo-annex-${stamp}.pdf`,
        },
      },
      finishing: {
        create: {
          totalFinishingPrice: 500_000,
          finishingContractFile: `demo-fin-${stamp}.pdf`,
        },
      },
      unitClients: {
        create: { clientId: client.id, role: "PRIMARY", position: 0 },
      },
    },
  });

  const target = await prisma.unit.create({
    data: {
      unitCode: targetCode,
      projectId: project.id,
    },
  });

  console.log(
    JSON.stringify(
      {
        project: project.name,
        sourceUnitId: source.id,
        sourceUnitCode: sourceCode,
        targetUnitId: target.id,
        targetUnitCode: targetCode,
        clientName: client.name,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
