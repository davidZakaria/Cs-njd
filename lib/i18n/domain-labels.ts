import { getTranslations } from "next-intl/server";

async function enumLabel(
  t: Awaited<ReturnType<typeof getTranslations>>,
  group: string,
  value: string
) {
  if (!value) return value;
  const key = `${group}.${value}` as Parameters<typeof t>[0];
  return t.has(key) ? await t(key) : value;
}

export async function getDomainLabels(locale: string) {
  const tEnums = await getTranslations({ locale, namespace: "enums" });
  const tProjects = await getTranslations({ locale, namespace: "projects" });
  const tStaff = await getTranslations({ locale, namespace: "staff" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

  return {
    all: await tCommon("all"),
    unassigned: await tCommon("unassigned"),
    unitType: (value: string) => enumLabel(tEnums, "unitType", value),
    handoverStatus: (value: string) => enumLabel(tEnums, "handoverStatus", value),
    ticketStatus: (value: string) => enumLabel(tEnums, "ticketStatus", value),
    ticketCategory: (value: string) => enumLabel(tEnums, "ticketCategory", value),
    role: (value: string) => enumLabel(tEnums, "role", value),
    finishingType: (value: string) => enumLabel(tEnums, "finishingType", value),
    finishingPackage: (value: string) => enumLabel(tEnums, "finishingPackage", value),
    executingCompany: (value: string) => enumLabel(tEnums, "executingCompany", value),
    finishingPhase: (value: string) => enumLabel(tEnums, "finishingPhase", value),
    project: async (value: string) => {
      if (!value) return value;
      return tProjects.has(value as Parameters<typeof tProjects>[0])
        ? await tProjects(value as Parameters<typeof tProjects>[0])
        : value;
    },
    staffName: async (name: string) => {
      if (!name || name === "—" || name === "-") return await tCommon("unassigned");
      if (locale === "en") return name;
      return tStaff.has(name as Parameters<typeof tStaff>[0])
        ? await tStaff(name as Parameters<typeof tStaff>[0])
        : name;
    },
    areaWithUnit: async (area: number | null) =>
      area == null ? "—" : `${area} ${await tEnums("areaSqm")}`,
  };
}

export type DomainLabels = Awaited<ReturnType<typeof getDomainLabels>>;
