"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { WorkScopeMode } from "@/lib/work/personal-scope";
import {
  mergeWorkScopeIntoSearchParams,
  workScopeToQueryParam,
} from "@/lib/work/work-scope-url";

export function WorkScopeToggle({
  mode,
  className,
}: {
  mode: WorkScopeMode;
  className?: string;
}) {
  const t = useTranslations("unitCycle.workScope");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function setScope(next: WorkScopeMode) {
    const params = mergeWorkScopeIntoSearchParams(
      new URLSearchParams(searchParams.toString()),
      next
    );
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <Tabs
      value={workScopeToQueryParam(mode)}
      onValueChange={(value) => setScope(value === "all" ? "oversight" : "personal")}
      className={className}
    >
      <TabsList>
        <TabsTrigger value="mine">{t("mine")}</TabsTrigger>
        <TabsTrigger value="all">{t("all")}</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
