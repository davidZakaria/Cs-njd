"use client";

import { useTranslations } from "next-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { ContractUnitUpdateFlagKey } from "@/lib/units/contract-unit-update-flags";

const FLAG_I18N: Record<ContractUnitUpdateFlagKey, string> = {
  preliminary: "preliminary",
  saleAnnex: "saleAnnex",
  gracePeriodAnnex: "gracePeriodAnnex",
  handoverRecord: "handoverRecord",
  finalSale: "finalSale",
};

export function UnitContractUpdateFlags({
  contractFlags,
  finishingNeedsUpdate,
}: {
  contractFlags: string[];
  finishingNeedsUpdate: boolean;
}) {
  const t = useTranslations("units.contractUpdate");
  const hasAny = contractFlags.length > 0 || finishingNeedsUpdate;
  if (!hasAny) return null;

  return (
    <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10">
      <AlertTitle>{t("bannerTitle")}</AlertTitle>
      <AlertDescription className="mt-2 flex flex-wrap gap-2">
        {contractFlags.map((flag) => {
          const key = flag as ContractUnitUpdateFlagKey;
          const label = FLAG_I18N[key] ? t(FLAG_I18N[key]) : flag;
          return (
            <Badge key={flag} variant="outline" className="bg-background/80">
              {label} — {t("needsUpdate")}
            </Badge>
          );
        })}
        {finishingNeedsUpdate ? (
          <Badge variant="outline" className="bg-background/80">
            {t("finishingContract")} — {t("needsUpdate")}
          </Badge>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
