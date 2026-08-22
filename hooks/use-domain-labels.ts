"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

function enumLabel(
  t: ReturnType<typeof useTranslations>,
  group: string,
  value: string
) {
  if (!value) return value;
  const key = `${group}.${value}` as Parameters<typeof t>[0];
  return t.has(key) ? t(key) : value;
}

export function useDomainLabels() {
  const locale = useLocale();
  const tEnums = useTranslations("enums");
  const tProjects = useTranslations("projects");
  const tStaff = useTranslations("staff");
  const tCommon = useTranslations("common");

  return useMemo(
    () => ({
      locale,
      all: tCommon("all"),
      unassigned: tCommon("unassigned"),
      unitType: (value: string) => enumLabel(tEnums, "unitType", value),
      handoverStatus: (value: string) =>
        enumLabel(tEnums, "handoverStatus", value),
      ticketStatus: (value: string) => enumLabel(tEnums, "ticketStatus", value),
      ticketCategory: (value: string) =>
        enumLabel(tEnums, "ticketCategory", value),
      role: (value: string) => enumLabel(tEnums, "role", value),
      finishingType: (value: string) =>
        enumLabel(tEnums, "finishingType", value),
      finishingPackage: (value: string) =>
        enumLabel(tEnums, "finishingPackage", value),
      executingCompany: (value: string) =>
        enumLabel(tEnums, "executingCompany", value),
      project: (value: string) => {
        if (!value) return value;
        return tProjects.has(value as Parameters<typeof tProjects>[0])
          ? tProjects(value as Parameters<typeof tProjects>[0])
          : value;
      },
      staffName: (name: string) => {
        if (!name || name === "—" || name === "-") return tCommon("unassigned");
        if (locale === "en") return name;
        return tStaff.has(name as Parameters<typeof tStaff>[0])
          ? tStaff(name as Parameters<typeof tStaff>[0])
          : name;
      },
      areaWithUnit: (area: number | null) =>
        area == null ? "—" : `${area} ${tEnums("areaSqm")}`,
    }),
    [locale, tCommon, tEnums, tProjects, tStaff]
  );
}
