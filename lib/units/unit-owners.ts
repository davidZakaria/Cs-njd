import type { Prisma } from "@prisma/client";

const clientWithContactsInclude = {
  phones: { orderBy: { sortOrder: "asc" as const } },
  addresses: { orderBy: { sortOrder: "asc" as const } },
};

export const unitOwnersInclude = {
  client: { include: clientWithContactsInclude },
  unitClients: {
    orderBy: { position: "asc" as const },
    include: {
      client: { include: clientWithContactsInclude },
    },
  },
} satisfies Prisma.UnitInclude;

type OwnerClient = Prisma.ClientGetPayload<{
  include: typeof clientWithContactsInclude;
}>;

export type UnitWithOwners = Prisma.UnitGetPayload<{
  include: typeof unitOwnersInclude;
}>;

export function orderedUnitOwners(unit: UnitWithOwners) {
  const links = unit.unitClients;
  if (links.length > 0) {
    return links.map((link) => ({
      linkId: link.id,
      role: link.role,
      position: link.position,
      client: link.client,
    }));
  }
  if (unit.clientId && unit.client) {
    return [
      {
        linkId: null as string | null,
        role: "PRIMARY" as const,
        position: 0,
        client: unit.client,
      },
    ];
  }
  return [] as Array<{
    linkId: string | null;
    role: "PRIMARY" | "CO_OWNER";
    position: number;
    client: OwnerClient;
  }>;
}

export function extraOwnerCount(unit: { unitClients?: { role: string }[] }) {
  return unit.unitClients?.filter((l) => l.role === "CO_OWNER").length ?? 0;
}
