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

export const unitProfileFormSchema = z.object({
  unitId: z.string().min(1),
  clientName: z.string().min(1),
  phone1: optionalString(),
  phone2: optionalString(),
  email: optionalEmail(),
  nationalId: optionalString(),
  address1: optionalString(),
  address2: optionalString(),
  deliveryYear: optionalString(),
  gracePeriod: optionalString(),
  contractPricePerMeter: optionalNumber(),
  type: z.enum(unitTypeValues),
});

export type UnitProfileFormInput = z.input<typeof unitProfileFormSchema>;
export type UnitProfileFormValues = z.output<typeof unitProfileFormSchema>;

export const UNIT_TYPE_OPTIONS = unitTypeValues;
