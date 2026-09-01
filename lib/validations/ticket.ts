import { z } from "zod";

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

export const TICKET_STATUSES = [
  "PENDING",
  "ENGINEERING",
  "LEGAL",
  "RESOLVED",
] as const;

export const TICKET_CATEGORIES = [
  "CUSTOMER_SERVICE",
  "FEEDBACK_HISTORY",
  "LEGAL",
  "GENERAL",
] as const;

export const PENDING_PARTIES = [
  "NONE",
  "CLIENT",
  "ENGINEERING",
  "LEGAL",
  "FINANCE",
  "MANAGEMENT",
  "LOGISTICS",
] as const;

export const ticketManageSchema = z.object({
  id: z.string().min(1),
  notes: z.string().min(1, "Notes are required"),
  status: z.enum(TICKET_STATUSES),
  category: z.enum(TICKET_CATEGORIES),
  pendingParty: z.enum(PENDING_PARTIES).optional(),
  nextFollowUpDate: optionalDate(),
  managementOverride: z.boolean().optional(),
});

export type TicketManageInput = z.infer<typeof ticketManageSchema>;
