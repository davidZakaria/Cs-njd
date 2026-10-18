import type { Prisma } from "@prisma/client";

/** OR clause: match unit by any linked owner (or legacy primary client). */
export function unitMatchesOwnerSearchQuery(
  trimmed: string
): Prisma.UnitWhereInput {
  const clientMatch: Prisma.ClientWhereInput = {
    OR: [
      { name: { contains: trimmed, mode: "insensitive" } },
      { nationalId: { contains: trimmed } },
      { phone1: { contains: trimmed } },
      { phone2: { contains: trimmed } },
      { phones: { some: { phone: { contains: trimmed } } } },
    ],
  };

  return {
    OR: [
      { unitCode: { contains: trimmed, mode: "insensitive" } },
      { client: clientMatch },
      { unitClients: { some: { client: clientMatch } } },
    ],
  };
}
