"use client";

import { useLocale, useTranslations } from "next-intl";

import { ActiveSessionsTable, type ActiveSessionUserRow } from "@/components/system/active-sessions-table";
import { LoginHistoryTable, type LoginHistoryRow } from "@/components/system/login-history-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function SystemSecurityPanel({
  loginHistory,
  users,
  currentUserId,
}: {
  loginHistory: LoginHistoryRow[];
  users: ActiveSessionUserRow[];
  currentUserId: string;
}) {
  const t = useTranslations("systemSecurity");
  const locale = useLocale();

  return (
    <div className="space-y-6" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Tabs defaultValue="history">
        <TabsList className="h-auto flex-wrap gap-1">
          <TabsTrigger value="history">{t("tabHistory")}</TabsTrigger>
          <TabsTrigger value="sessions">{t("tabSessions")}</TabsTrigger>
        </TabsList>
        <TabsContent value="history" className="mt-4">
          <LoginHistoryTable data={loginHistory} />
        </TabsContent>
        <TabsContent value="sessions" className="mt-4">
          <ActiveSessionsTable data={users} currentUserId={currentUserId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
