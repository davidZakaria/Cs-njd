import { ExecutingCompany, FinishingPackage, FinishingPhase } from "@prisma/client";
import { z } from "zod";

const finishingPackageValues = Object.values(FinishingPackage) as [
  FinishingPackage,
  ...FinishingPackage[],
];

const finishingPhaseValues = Object.values(FinishingPhase) as [
  FinishingPhase,
  ...FinishingPhase[],
];

const executingCompanyValues = Object.values(ExecutingCompany) as [
  ExecutingCompany,
  ...ExecutingCompany[],
];

function optionalNumber() {
  return z
    .union([z.coerce.number(), z.literal(""), z.null()])
    .optional()
    .transform((value) => {
      if (value === "" || value == null || Number.isNaN(value)) return null;
      return value;
    });
}

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

function optionalEnum<T extends string>(values: readonly T[]) {
  return z
    .union([z.enum(values as [T, ...T[]]), z.literal(""), z.null()])
    .optional()
    .transform((value) => {
      if (!value || value === "") return null;
      return value;
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

function optionalPhases() {
  return z
    .array(z.enum(finishingPhaseValues))
    .default([])
    .transform((value) => {
      const unique = [...new Set(value)];
      return unique.length ? unique : (["NOT_STARTED"] as FinishingPhase[]);
    });
}

export const finishingFormSchema = z.object({
  unitId: z.string().min(1),
  packageType: optionalEnum(finishingPackageValues),
  executingCompany: optionalEnum(executingCompanyValues),
  contractDate: optionalDate(),
  datedAt: optionalDate(),
  emailDate: optionalDate(),
  pricePerMeter: optionalNumber(),
  totalFinishingPrice: optionalNumber(),
  doorFees: optionalNumber(),
  aluminumFees: optionalNumber(),
  phases: optionalPhases(),
  currentFinishingStatus: optionalString(),
});

export type FinishingFormInput = z.input<typeof finishingFormSchema>;
export type FinishingFormValues = z.output<typeof finishingFormSchema>;

export const FINISHING_PACKAGE_OPTIONS = finishingPackageValues;
export const EXECUTING_COMPANY_OPTIONS = executingCompanyValues;
export const FINISHING_PHASE_OPTIONS = finishingPhaseValues;
