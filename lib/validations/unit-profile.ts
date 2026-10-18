import { UnitType } from "@prisma/client";
import { z } from "zod";

const unitTypeValues = Object.values(UnitType) as [UnitType, ...UnitType[]];

function optionalString() {
  return z
    .union([z.string(), z.literal(""), z.null()])
    .optional()
    .transform((value) => {
      if (value == null) return null;
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    });
}

function optionalNumber() {
  return z
    .union([z.coerce.number(), z.literal(""), z.null()])
    .optional()
    .transform((value) => {
      if (value === "" || value == null || Number.isNaN(value)) return null;
      return value;
    });
}

function optionalEmail() {
  return z
    .union([z.string().email(), z.literal(""), z.null()])
    .optional()
    .transform((value) => {
      if (value == null || value === "") return null;
      return value.trim();
    });
}

/** Same shape as optionalEmail output, without RFC email validation (CS view-only fields). */
function optionalEmailLoose() {
  return z
    .union([z.string(), z.literal(""), z.null()])
    .optional()
    .transform((value) => {
      if (value == null || value === "") return null;
      return value.trim();
    });
}

const contactExtraLineSchema = z.object({
  id: optionalString(),
  value: z.string(),
});

export const unitProfileFormSchema = z.object({
  unitId: z.string().min(1),
  clientId: z.string().optional(),
  unitCode: z.string().min(1).optional(),
  agentId: optionalString(),
  clientName: z.string().min(1),
  phone1: optionalString(),
  phone2: optionalString(),
  email: optionalEmail(),
  nationalId: optionalString(),
  address1: optionalString(),
  address2: optionalString(),
  extraPhones: z.array(contactExtraLineSchema).optional(),
  extraAddresses: z.array(contactExtraLineSchema).optional(),
  deliveryYear: optionalString(),
  gracePeriod: optionalString(),
  contractPricePerMeter: optionalNumber(),
  area: optionalNumber(),
  type: z.enum(unitTypeValues),
});

/**
 * CS agents only edit phones/addresses; identity fields skip strict validation
 * but keep the same output types as unitProfileFormSchema for shared form/action typing.
 */
export const csAgentUnitProfileFormSchema = unitProfileFormSchema.extend({
  clientName: z.string(),
  email: optionalEmailLoose(),
});

export const createUnitFormSchema = z.object({
  projectId: z.string().min(1),
  unitCode: z.string().min(1),
  type: z.enum(unitTypeValues),
  clientName: z.string().min(1),
  phone1: optionalString(),
  phone2: optionalString(),
  email: optionalEmail(),
  nationalId: optionalString(),
  address1: optionalString(),
  address2: optionalString(),
  area: optionalNumber(),
  contractPricePerMeter: optionalNumber(),
  agentId: optionalString(),
});

export type CreateUnitFormInput = z.input<typeof createUnitFormSchema>;
export type CreateUnitFormValues = z.output<typeof createUnitFormSchema>;

export type UnitProfileFormInput = z.input<typeof unitProfileFormSchema>;
export type UnitProfileFormValues = z.output<typeof unitProfileFormSchema>;
export type CsAgentUnitProfileFormValues = z.output<
  typeof csAgentUnitProfileFormSchema
>;

export const UNIT_TYPE_OPTIONS = unitTypeValues;
