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
  Shield,
  Gauge,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import type { Role } from "@prisma/client";
import { getCoreNavItems, getNavItems } from "@/lib/rbac";
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
import { NotificationBell } from "@/components/layout/notification-bell";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import { AdminNavGroups } from "@/components/layout/admin-nav-groups";
import { GlobalAnnouncementBanner } from "@/components/layout/global-announcement-banner";
import { NjdMark } from "@/components/brand/njd-mark";

const iconMap = {
  dashboard: LayoutDashboard,
  executive: BarChart3,
  cases: ClipboardList,
  units: Building2,
  users: Users,
  imports: FileUp,
  auditLogs: ScrollText,
  backups: Database,
  loginHistory: Shield,
  systemHealth: Gauge,
  systemSettings: Settings,
  system: Settings,
} as const;

function DashboardTopBar() {
  const locale = useLocale();

  return (
    <header className="sticky top-0 z-50 -mx-4 mb-5 border-b border-border/50 bg-background/80 px-4 py-3 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60 md:-mx-6 md:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger className="shrink-0 transition-transform duration-300 active:scale-95" />
          <p className="hidden truncate text-sm font-medium text-muted-foreground sm:block">
            NJD Post-Sales CRM
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <NotificationBell locale={locale} />
          <ThemeToggle />
          <LanguageToggle />
        </div>
      </div>
    </header>
  );
}

export function AppSidebar({ role }: { role: Role }) {
  const locale = useLocale();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const coreItems = getCoreNavItems(role);
  const flatItems =
    role === "SUPER_ADMIN" ? coreItems : getNavItems(role);
  const isRtl = locale === "ar";

  return (
    <Sidebar collapsible="icon" side={isRtl ? "right" : "left"}>
      <SidebarHeader className="border-b border-border/50 px-4 py-4">
        <div className="flex items-center gap-2.5 font-heading text-base font-semibold tracking-tight [dir=rtl]:flex-row-reverse">
          <NjdMark size={32} className="rounded-lg shadow-sm" />
          <span className="truncate group-data-[collapsible=icon]:hidden">NJD CRM</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-1 py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="font-heading text-xs uppercase tracking-wider text-muted-foreground/80">
            {tCommon("menu")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {flatItems.map((item) => {
                const Icon = iconMap[item.key];
                const active =
                  item.href === "/system"
                    ? pathname === "/system"
                    : pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      className={cn(
                        "rounded-lg [dir=rtl]:flex-row-reverse",
                        active && "bg-primary/10"
                      )}
                      render={<Link href={item.href} />}
                    >
                      {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
                      <span>{t(item.key)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
            {role === "SUPER_ADMIN" ? <AdminNavGroups /> : null}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-2 border-t border-border/50 p-3">
        <form action={signOutAction}>
          <Button
            variant="outline"
            className="w-full transition-all duration-300 hover:bg-primary/5 active:scale-[0.98]"
            type="submit"
          >
            {tCommon("signOut")}
          </Button>
        </form>
      </SidebarFooter>
    </Sidebar>
  );
}

export function DashboardShell({
  role,
  announcementText,
  children,
}: {
  role: Role;
  announcementText?: string | null;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar role={role} />
      <SidebarInset className="min-h-svh min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
        <div className="flex min-h-full flex-col p-4 md:p-6">
          {announcementText ? (
            <GlobalAnnouncementBanner text={announcementText} />
          ) : null}
          <DashboardTopBar />
          <div className="flex-1 animate-fade-in">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
