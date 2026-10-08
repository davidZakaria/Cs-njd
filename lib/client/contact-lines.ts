import type { Client, ClientAddress, ClientPhone } from "@prisma/client";

export type ClientExtraPhone = Pick<ClientPhone, "id" | "phone" | "sortOrder">;
export type ClientExtraAddress = Pick<ClientAddress, "id" | "address" | "sortOrder">;

export type ClientWithContactLines = Pick<
  Client,
  "phone1" | "phone2" | "address1" | "address2"
> & {
  phones?: ClientExtraPhone[];
  addresses?: ClientExtraAddress[];
};

export function normalizeContactValue(value: string | null | undefined): string {
  return (value ?? "").trim();
}

/** Extra phones from relation, plus legacy phone2 when not yet in the list. */
export function listClientExtraPhones(client: ClientWithContactLines): ClientExtraPhone[] {
  const fromRelation = [...(client.phones ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
  const legacy = normalizeContactValue(client.phone2);
  const primary = normalizeContactValue(client.phone1);
  if (!legacy || legacy === primary) {
    return fromRelation;
  }
  const alreadyListed = fromRelation.some(
    (row) => normalizeContactValue(row.phone) === legacy
  );
  if (alreadyListed) {
    return fromRelation;
  }
  return [
    ...fromRelation,
    { id: `legacy-phone2`, phone: legacy, sortOrder: fromRelation.length },
  ];
}

export function listClientExtraAddresses(
  client: ClientWithContactLines
): ClientExtraAddress[] {
  const fromRelation = [...(client.addresses ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
  const legacy = normalizeContactValue(client.address2);
  const primary = normalizeContactValue(client.address1);
  if (!legacy || legacy === primary) {
    return fromRelation;
  }
  const alreadyListed = fromRelation.some(
    (row) => normalizeContactValue(row.address) === legacy
  );
  if (alreadyListed) {
    return fromRelation;
  }
  return [
    ...fromRelation,
    { id: `legacy-address2`, address: legacy, sortOrder: fromRelation.length },
  ];
}

export function allClientPhoneValues(client: ClientWithContactLines): string[] {
  const primary = normalizeContactValue(client.phone1);
  const extras = listClientExtraPhones(client).map((row) =>
    normalizeContactValue(row.phone)
  );
  return [primary, ...extras].filter(Boolean);
}

export function allClientAddressValues(client: ClientWithContactLines): string[] {
  const primary = normalizeContactValue(client.address1);
  const extras = listClientExtraAddresses(client).map((row) =>
    normalizeContactValue(row.address)
  );
  return [primary, ...extras].filter(Boolean);
}

export function isPersistedExtraId(id: string): boolean {
  return !id.startsWith("legacy-");
}

export type ContactExtraLine = { id: string; value: string };

export function toContactExtraLines(
  phones: ClientExtraPhone[],
  addresses: ClientExtraAddress[]
): { phones: ContactExtraLine[]; addresses: ContactExtraLine[] } {
  return {
    phones: phones.map((row) => ({
      id: isPersistedExtraId(row.id) ? row.id : "",
      value: row.phone,
    })),
    addresses: addresses.map((row) => ({
      id: isPersistedExtraId(row.id) ? row.id : "",
      value: row.address,
    })),
  };
}
