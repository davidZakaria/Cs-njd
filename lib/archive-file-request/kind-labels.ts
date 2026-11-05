import type { ArchiveFileKind } from "@prisma/client";

/** Bilingual labels aligned with messages `enums.archiveFileKind.*`. */
export const ARCHIVE_FILE_KIND_BILINGUAL: Record<
  ArchiveFileKind,
  { en: string; ar: string }
> = {
  CONTRACT: { en: "Contract", ar: "عقد" },
  NATIONAL_ID: { en: "National ID", ar: "بطاقة الرقم القومي" },
  ANNEX: { en: "Annex", ar: "ملحق" },
  RECEIPT: { en: "Receipt", ar: "إيصال" },
  OTHER: { en: "Other", ar: "أخرى" },
};

export function archiveFileKindLabel(
  kind: ArchiveFileKind,
  locale: "en" | "ar"
): string {
  return ARCHIVE_FILE_KIND_BILINGUAL[kind][locale];
}
