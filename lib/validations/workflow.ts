import { HandoverStatus, PendingParty } from "@prisma/client";
import { z } from "zod";

const handoverStatusValues = Object.values(HandoverStatus) as [
  HandoverStatus,
  ...HandoverStatus[],
];

const pendingPartyValues = Object.values(PendingParty) as [
  PendingParty,
  ...PendingParty[],
];

function optionalDate() {
  return z
    .union([z.string(), z.date(), z.literal(""), z.null()])
    .optional()
    .transform((value) => {
      if (!value || value === "") return null;
      if (value instanceof Date) return value;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    });
}

function optionalString() {
  return z
    .union([z.string(), z.literal(""), z.null()])
    .optional()
    .transform((value) => {
      if (value == null) return null;
      const trimmed = String(value).trim();
      return trimmed === "" ? null : trimmed;
    });
}

export const ticketWorkflowSchema = z.object({
  ticketId: z.string().min(1),
  pendingParty: z.enum(pendingPartyValues),
  nextFollowUpDate: optionalDate(),
});

export type TicketWorkflowInput = z.infer<typeof ticketWorkflowSchema>;

export const handoverChecklistSchema = z.object({
  unitId: z.string().min(1),
  handoverStatus: z.enum(handoverStatusValues),
  actionLabel: optionalString(),
  contractDate: optionalDate(),
  deliveryDate: optionalDate(),
  hasSignedProtocol: z.boolean(),
  hasSignedExtension: z.boolean(),
  hasPaidFees: z.boolean(),
  papersReceived: z.boolean(),
  powerOfAttorneyReceived: z.boolean(),
  isLegallyBlocked: z.boolean(),
  inspectionDate: optionalDate(),
});

export type HandoverChecklistInput = z.infer<typeof handoverChecklistSchema>;
export type HandoverChecklistFormInput = z.input<typeof handoverChecklistSchema>;

export const HANDOVER_STATUS_OPTIONS = handoverStatusValues;
