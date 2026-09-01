import type { CanonicalProject } from "@/lib/projects";
import type { HandoverTemplateKey, HandoverTemplateOptions } from "./types";

import greenAvenue from "./generated/green-avenue.json";
import greenAvenueDual from "./generated/green-avenue-dual.json";
import greenAvenueDualNoInsurance from "./generated/green-avenue-dual-no-insurance.json";
import greenAvenueNoInsurance from "./generated/green-avenue-no-insurance.json";
import jura from "./generated/jura.json";
import juraDual from "./generated/jura-dual.json";

const GREEN_AVENUE_TEMPLATES = {
  "green-avenue": greenAvenue,
  "green-avenue-no-insurance": greenAvenueNoInsurance,
  "green-avenue-dual": greenAvenueDual,
  "green-avenue-dual-no-insurance": greenAvenueDualNoInsurance,
} as const;

const JURA_TEMPLATES = {
  jura,
  "jura-dual": juraDual,
} as const;

export function resolveHandoverTemplateKey(
  projectName: string,
  options: HandoverTemplateOptions = {}
): HandoverTemplateKey {
  const insurance = options.insurance ?? true;
  const dual = options.dualSignature ?? false;

  if (projectName === "GREEN AVENUE") {
    if (dual) return insurance ? "green-avenue-dual" : "green-avenue-dual-no-insurance";
    return insurance ? "green-avenue" : "green-avenue-no-insurance";
  }

  if (projectName === "JURA") {
    return dual ? "jura-dual" : "jura";
  }

  if (dual) return insurance ? "green-avenue-dual" : "green-avenue-dual-no-insurance";
  return insurance ? "green-avenue" : "green-avenue-no-insurance";
}

export function loadHandoverTemplate(key: HandoverTemplateKey) {
  if (key.startsWith("green-avenue")) {
    return { ...GREEN_AVENUE_TEMPLATES[key as keyof typeof GREEN_AVENUE_TEMPLATES], kind: "green-avenue" as const };
  }
  return { ...JURA_TEMPLATES[key as keyof typeof JURA_TEMPLATES], kind: "jura" as const };
}

export function parseHandoverSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): HandoverTemplateOptions {
  const insuranceParam = pick(searchParams, "insurance");
  const dualParam = pick(searchParams, "dual");

  return {
    insurance:
      insuranceParam === "no" ? false : insuranceParam === "yes" ? true : undefined,
    dualSignature:
      dualParam === "yes" ? true : dualParam === "no" ? false : undefined,
  };
}

export function isSupportedHandoverProject(name: string): name is CanonicalProject {
  return name === "GREEN AVENUE" || name === "JURA";
}

function pick(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export const HANDOVER_VARIANT_OPTIONS = [
  {
    key: "standard",
    insurance: true,
    dualSignature: false,
    labelKey: "variantStandard",
  },
  {
    key: "no-insurance",
    insurance: false,
    dualSignature: false,
    labelKey: "variantNoInsurance",
  },
  {
    key: "dual",
    insurance: true,
    dualSignature: true,
    labelKey: "variantDual",
  },
  {
    key: "dual-no-insurance",
    insurance: false,
    dualSignature: true,
    labelKey: "variantDualNoInsurance",
  },
] as const;
