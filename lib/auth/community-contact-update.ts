import { actionFail, type ActionResult } from "@/lib/actions/result";

type ClientContactSnapshot = {
  name: string;
  phone1: string | null;
  phone2: string | null;
  email: string | null;
  nationalId: string | null;
  address1: string | null;
  address2: string | null;
};

type CommunityContactInput = {
  clientName: string;
  phone1: string | null | undefined;
  phone2: string | null | undefined;
  email: string | null | undefined;
  nationalId: string | null | undefined;
  address1: string | null | undefined;
  address2: string | null | undefined;
};

function norm(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function unchanged(existing: string | null, next: string | null | undefined): boolean {
  return norm(existing) === norm(next);
}

export type CommunityClientUpdateData = {
  phone2: string | null;
  address2: string | null;
};

/**
 * Community management may only fill empty secondary phone/address slots.
 * Primary contact fields and all other client data must remain unchanged.
 */
export function validateCommunityClientContactUpdate(
  existing: ClientContactSnapshot,
  input: CommunityContactInput
): ActionResult | CommunityClientUpdateData {
  if (!unchanged(existing.name, input.clientName)) {
    return actionFail("Cannot change client name");
  }
  if (!unchanged(existing.phone1, input.phone1)) {
    return actionFail("Cannot change primary phone number");
  }
  if (!unchanged(existing.email, input.email)) {
    return actionFail("Cannot change email");
  }
  if (!unchanged(existing.nationalId, input.nationalId)) {
    return actionFail("Cannot change national ID");
  }
  if (!unchanged(existing.address1, input.address1)) {
    return actionFail("Cannot change primary address");
  }

  const existingPhone2 = norm(existing.phone2);
  const nextPhone2 = norm(input.phone2);
  if (existingPhone2 && nextPhone2 !== existingPhone2) {
    return actionFail("Cannot change or remove secondary phone number");
  }

  const existingAddress2 = norm(existing.address2);
  const nextAddress2 = norm(input.address2);
  if (existingAddress2 && nextAddress2 !== existingAddress2) {
    return actionFail("Cannot change or remove secondary address");
  }

  return {
    phone2: existingPhone2 || nextPhone2 || null,
    address2: existingAddress2 || nextAddress2 || null,
  };
}
