import "dotenv/config";

import { PrismaClient } from "@prisma/client";

import { DEFAULT_OFFICIAL_DOCUMENT_TEMPLATES } from "@/lib/official-documents/default-templates";

const prisma = new PrismaClient();

async function main() {
  for (const seed of DEFAULT_OFFICIAL_DOCUMENT_TEMPLATES) {
    const existing = await prisma.officialDocumentTemplate.findFirst({
      where: {
        documentType: seed.documentType,
        locale: seed.locale,
        version: 1,
      },
    });
    if (existing) continue;

    await prisma.officialDocumentTemplate.updateMany({
      where: {
        documentType: seed.documentType,
        locale: seed.locale,
        isActive: true,
      },
      data: { isActive: false },
    });

    await prisma.officialDocumentTemplate.create({
      data: {
        documentType: seed.documentType,
        locale: seed.locale,
        version: 1,
        title: seed.title,
        body: seed.body,
        isActive: true,
      },
    });
  }

  console.log("Official document templates seeded (v1).");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
