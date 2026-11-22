/**
 * Dry-run by default: reports phone fields that still carry Excel `.0` suffixes.
 * Pass `--apply` to write fixes (idempotent). Use only on a copy / staging DB.
 */
import { PrismaClient } from "@prisma/client";

import { formatPhoneForDisplay } from "@/lib/phone/display";
import { stripExcelNumericSuffix } from "@/lib/utils/arabic-normalize";

const apply = process.argv.includes("--apply");

function needsCleanup(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  return stripExcelNumericSuffix(value) !== value.trim();
}

async function main() {
  const prisma = new PrismaClient();
  const clientUpdates: Array<{ id: string; field: string; from: string; to: string }> =
    [];
  const extraPhoneUpdates: Array<{ id: string; from: string; to: string }> = [];

  const clients = await prisma.client.findMany({
    select: { id: true, phone1: true, phone2: true },
  });

  for (const client of clients) {
    for (const field of ["phone1", "phone2"] as const) {
      const raw = client[field];
      if (!needsCleanup(raw)) continue;
      clientUpdates.push({
        id: client.id,
        field,
        from: raw!.trim(),
        to: formatPhoneForDisplay(raw),
      });
    }
  }

  const extraPhones = await prisma.clientPhone.findMany({
    select: { id: true, phone: true },
  });
  for (const row of extraPhones) {
    if (!needsCleanup(row.phone)) continue;
    extraPhoneUpdates.push({
      id: row.id,
      from: row.phone.trim(),
      to: formatPhoneForDisplay(row.phone),
    });
  }

  const total = clientUpdates.length + extraPhoneUpdates.length;
  console.log(
    apply
      ? `Applying ${total} phone cleanup(s)…`
      : `Dry run: ${total} phone value(s) would change (${clientUpdates.length} client fields, ${extraPhoneUpdates.length} extra phones).`
  );

  if (clientUpdates.length > 0) {
    console.log("\nClient fields:");
    for (const row of clientUpdates.slice(0, 20)) {
      console.log(`  ${row.id} ${row.field}: ${row.from} → ${row.to}`);
    }
    if (clientUpdates.length > 20) {
      console.log(`  … and ${clientUpdates.length - 20} more`);
    }
  }

  if (extraPhoneUpdates.length > 0) {
    console.log("\nClientPhone rows:");
    for (const row of extraPhoneUpdates.slice(0, 20)) {
      console.log(`  ${row.id}: ${row.from} → ${row.to}`);
    }
    if (extraPhoneUpdates.length > 20) {
      console.log(`  … and ${extraPhoneUpdates.length - 20} more`);
    }
  }

  if (!apply) {
    console.log("\nRe-run with --apply to persist changes.");
    await prisma.$disconnect();
    return;
  }

  for (const row of clientUpdates) {
    await prisma.client.update({
      where: { id: row.id },
      data: { [row.field]: row.to },
    });
  }
  for (const row of extraPhoneUpdates) {
    await prisma.clientPhone.update({
      where: { id: row.id },
      data: { phone: row.to },
    });
  }

  console.log(`Done. Updated ${total} value(s).`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});