"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ChevronDown,
  Database,
  FileUp,
  Gauge,
  ScrollText,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  getSuperAdminNavGroups,
  type NavGroupKey,
  type NavItemKey,
} from "@/lib/rbac";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const groupIconMap = {
  usersSecurity: Shield,
  dataHub: Database,
  monitoring: Activity,
  systemAdmin: Settings,
} as const;

const itemIconMap: Partial<Record<NavItemKey, typeof Users>> = {
  users: Users,
  loginHistory: Shield,
  imports: FileUp,
  backups: Database,
  auditLogs: ScrollText,
  systemHealth: Gauge,
  systemSettings: Settings,
  system: Settings,
};

function isPathActive(pathname: string, href: string) {
  if (href === "/system/system") {
    return pathname === "/system/system";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AdminNavGroup({
  groupKey,
  items,
  pathname,
  defaultOpen,
}: {
  groupKey: NavGroupKey;
  items: Array<{ href: string; key: NavItemKey }>;
  pathname: string;
  defaultOpen: boolean;
}) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(defaultOpen);
  const GroupIcon = groupIconMap[groupKey];
  const groupActive = items.some((item) => isPathActive(pathname, item.href));

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  return (
    <SidebarMenuItem className="group/admin-nav">
      <SidebarMenuButton
        type="button"
        isActive={groupActive}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "rounded-lg transition-all duration-300 [dir=rtl]:flex-row-reverse",
          groupActive && "bg-primary/10",
          open && "bg-sidebar-accent/40"
        )}
      >
        <GroupIcon className="size-4 shrink-0" />
        <span className="flex-1 truncate text-start">{t(`groups.${groupKey}`)}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-300",
            open && "rotate-180"
          )}
        />
      </SidebarMenuButton>
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-70"
        )}
      >
        <div className="overflow-hidden">
          <SidebarMenuSub className="border-l border-sidebar-border [dir=rtl]:translate-x-0 [dir=rtl]:border-l-0 [dir=rtl]:border-r [dir=rtl]:pe-2.5 [dir=rtl]:ps-0">
            {items.map((item) => {
              const ItemIcon = itemIconMap[item.key];
              const active = isPathActive(pathname, item.href);
              return (
                <SidebarMenuSubItem key={item.href}>
                  <SidebarMenuSubButton
                    isActive={active}
                    className={cn(
                      "rounded-md transition-colors duration-200 [dir=rtl]:flex-row-reverse",
                      active && "bg-primary/10 font-medium text-primary"
                    )}
                    render={<Link href={item.href} />}
                  >
                    {ItemIcon ? <ItemIcon className="size-3.5 shrink-0 opacity-80" /> : null}
                    <span>{t(item.key)}</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </div>
      </div>
    </SidebarMenuItem>
  );
}

export function AdminNavGroups() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const groups = useMemo(() => getSuperAdminNavGroups(), []);

  const openByDefault = useMemo(() => {
    const map = new Map<NavGroupKey, boolean>();
    for (const group of groups) {
      map.set(
        group.key,
        group.items.some((item) => isPathActive(pathname, item.href))
      );
    }
    return map;
  }, [groups, pathname]);

  return (
    <>
      <p className="px-2 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
        {t("administration")}
      </p>
      <SidebarMenu className="gap-1">
        {groups.map((group) => (
          <AdminNavGroup
            key={group.key}
            groupKey={group.key}
            items={group.items}
            pathname={pathname}
            defaultOpen={openByDefault.get(group.key) ?? false}
          />
        ))}
      </SidebarMenu>
    </>
  );
}
