import type { Prisma } from "@prisma/client";

import {
  digitsToWestern,
  searchDigitVariants,
} from "@/lib/format/locale-display";

/** OR clause: match unit by any linked owner (or legacy primary client). */
export function unitMatchesOwnerSearchQuery(
  trimmed: string
): Prisma.UnitWhereInput {
  const digitVariants = searchDigitVariants(trimmed);
  const phoneContains = digitVariants.flatMap((variant) => [
    { phone1: { contains: variant } },
    { phone2: { contains: variant } },
    { phones: { some: { phone: { contains: variant } } } },
  ]);
  const idContains = [
    { nationalId: { contains: trimmed } },
    ...digitVariants
      .filter((v) => v !== trimmed)
      .map((variant) => ({ nationalId: { contains: variant } })),
  ];
  const unitCodeVariants = [trimmed, digitsToWestern(trimmed)];
  const clientMatch: Prisma.ClientWhereInput = {
    OR: [
      { name: { contains: trimmed, mode: "insensitive" } },
      ...idContains,
      ...phoneContains,
    ],
  };

  return {
    OR: [
      ...unitCodeVariants.map((variant) => ({
        unitCode: { contains: variant, mode: "insensitive" as const },
      })),
      { client: clientMatch },
      { unitClients: { some: { client: clientMatch } } },
    ],
  };
}
