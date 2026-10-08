import { actionFail, type ActionResult } from "@/lib/actions/result";
import {
  allClientAddressValues,
  allClientPhoneValues,
  normalizeContactValue,
  type ClientWithContactLines,
} from "@/lib/client/contact-lines";

export function validateCommunityExtraPhoneAdd(
  client: ClientWithContactLines,
  phone: string
): ActionResult | { phone: string } {
  const normalized = normalizeContactValue(phone);
  if (!normalized) {
    return actionFail("Phone number is required");
  }

  const existing = allClientPhoneValues(client);
  if (existing.some((value) => value === normalized)) {
    return actionFail("This phone number is already on file");
  }

  return { phone: normalized };
}

export function validateCommunityExtraAddressAdd(
  client: ClientWithContactLines,
  address: string
): ActionResult | { address: string } {
  const normalized = normalizeContactValue(address);
  if (!normalized) {
    return actionFail("Address is required");
  }

  const existing = allClientAddressValues(client);
  if (existing.some((value) => value === normalized)) {
    return actionFail("This address is already on file");
  }

  return { address: normalized };
}
