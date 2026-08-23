import { getTranslations } from "next-intl/server";
import type { ResolutionGateCode } from "@/lib/workflow/resolution-gates";

export async function formatResolutionGateErrors(
  codes: ResolutionGateCode[]
): Promise<string> {
  if (codes.length === 0) return "";

  const t = await getTranslations("workflow.errors");
  return codes.map((code) => t(code)).join(" ");
}
