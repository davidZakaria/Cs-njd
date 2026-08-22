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

export const unitProfileFormSchema = z.object({
  unitId: z.string().min(1),
  address1: optionalString(),
  address2: optionalString(),
  deliveryYear: optionalString(),
  gracePeriod: optionalString(),
  type: z.enum(unitTypeValues),
});

export type UnitProfileFormInput = z.input<typeof unitProfileFormSchema>;
export type UnitProfileFormValues = z.output<typeof unitProfileFormSchema>;

export const UNIT_TYPE_OPTIONS = unitTypeValues;
