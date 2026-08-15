"use client";

import {
  BarChart3,
  Building2,
  ClipboardList,
  Database,
  FileUp,
  LayoutDashboard,
  ScrollText,
  Settings,
  Users,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import type { Role } from "@prisma/client";
import { getNavItems } from "@/lib/rbac";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/actions/auth";

const iconMap = {
  dashboard: LayoutDashboard,
  executive: BarChart3,
  cases: ClipboardList,
  units: Building2,
  users: Users,
  imports: FileUp,
  auditLogs: ScrollText,
  backups: Database,
  system: Settings,
} as const;

export function AppSidebar({ role }: { role: Role }) {
  const locale = useLocale();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const items = getNavItems(role);
  const isRtl = locale === "ar";

  return (
    <Sidebar collapsible="icon" side={isRtl ? "right" : "left"}>
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2 font-semibold [dir=rtl]:flex-row-reverse">
          <Building2 className="h-5 w-5 shrink-0" />
          <span className="truncate">NJD CRM</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{tCommon("menu")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const Icon = iconMap[item.key as keyof typeof iconMap];
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      className="[dir=rtl]:flex-row-reverse"
                      render={<Link href={item.href} />}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{t(item.key)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-2 border-t p-3">
        <div className="flex items-center gap-1 [dir=rtl]:flex-row-reverse">
          <ThemeToggle />
          <LanguageToggle />
          <SidebarTrigger />
        </div>
        <form action={signOutAction}>
          <Button variant="outline" className="w-full" type="submit">
            {tCommon("signOut")}
          </Button>
        </form>
      </SidebarFooter>
    </Sidebar>
  );
}

export function DashboardShell({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar role={role} />
      <SidebarInset className="min-h-svh min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
