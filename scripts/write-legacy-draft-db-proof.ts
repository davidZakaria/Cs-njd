import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";

const STORE =
  process.env.HANDOVER_E2E_STORE?.trim() ||
  "/cursor/stores/self/handover-e2e-ui-evidence";

async function main() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(STORE, "manifest.json"), "utf8")
  ) as { legacyDraft?: { draftId: string; userEditMarker: string } };

  if (!manifest.legacyDraft) return;

  const draft = await prisma.officialDocumentTextDraft.findUnique({
    where: { id: manifest.legacyDraft.draftId },
    include: {
      versions: { orderBy: { createdAt: "asc" } },
    },
  });

  const marker = manifest.legacyDraft.userEditMarker;
  const proof = {
    draftId: manifest.legacyDraft.draftId,
    currentBodyHasMarker: draft?.currentBody.includes(marker) ?? false,
    currentBodyHasOfficialArabic: /محضر|أولاً/i.test(draft?.currentBody ?? ""),
    versionRows: draft?.versions.map((v) => ({
      id: v.id,
      createdAt: v.createdAt.toISOString(),
      bodyHasMarker: v.body.includes(marker),
      bodyPreview: v.body.slice(0, 100),
    })),
  };

  fs.writeFileSync(
    path.join(STORE, "legacy-draft-db-proof.json"),
    JSON.stringify(proof, null, 2)
  );
  console.log("Wrote legacy-draft-db-proof.json");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
