"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import {
  CalendarIcon,
  Loader2,
  Phone,
  StickyNote,
  Ticket,
  CheckCircle2,
  ArrowRightLeft,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import {
  loadCommunityDailyActivity,
  type SerializedCommunityDailyActivity,
} from "@/lib/actions/community-tracker";
import {
  isCommunityTrackerTeamView,
  type CommunityActivityActionType,
  type CommunityTrackerViewerRole,
} from "@/lib/services/community-tracker";
import { ExecutiveKpiGrid, type StatItem } from "@/components/executive/executive-kpi-grid";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { entranceAnimationClass } from "@/lib/ui/premium-motion";

const ALL_AGENTS = "all";

function todayDateInput(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function parseDateValue(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

const ACTION_ICON: Record<
  CommunityActivityActionType,
  typeof Ticket
> = {
  TICKET_OPENED: Ticket,
  CALL_LOGGED: Phone,
  TIMELINE_NOTE: StickyNote,
  STATUS_CHANGE: ArrowRightLeft,
  CASE_RESOLVED: CheckCircle2,
};

export function CommunityDailyTracker({
  initialData,
  initialDate = todayDateInput(),
  initialAgentId = ALL_AGENTS,
  viewerRole,
}: {
  initialData: SerializedCommunityDailyActivity;
  initialDate?: string;
  initialAgentId?: string;
  viewerRole: CommunityTrackerViewerRole;
}) {
  const teamView = isCommunityTrackerTeamView(viewerRole);
  const locale = useLocale();
  const dateLocale = locale === "ar" ? ar : enUS;
  const t = useTranslations("executive.communityTracking");
  const tCommon = useTranslations("common");

  const [dateInput, setDateInput] = useState(initialDate);
  const [agentFilter, setAgentFilter] = useState(initialAgentId);
  const [data, setData] = useState(initialData);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedDate = parseDateValue(dateInput);

  const agentOptions = useMemo(() => {
    const fromData = data.agents;
    const merged = new Map<string, string>();
    for (const agent of initialData.agents) {
      merged.set(agent.id, agent.name);
    }
    for (const agent of fromData) {
      merged.set(agent.id, agent.name);
    }
    return [...merged.entries()].map(([id, name]) => ({ id, name }));
  }, [data.agents, initialData.agents]);

  const refresh = useCallback(
    (nextDate: string, nextAgentId: string) => {
      setError(null);
      startTransition(async () => {
        const result = await loadCommunityDailyActivity({
          date: nextDate,
          agentId: nextAgentId,
        });
        if (!result.success) {
          setError(result.error);
          return;
        }
        if (!result.data) {
          setError(t("loadFailed"));
          return;
        }
        setData(result.data);
      });
    },
    [t]
  );

  const kpiItems = useMemo((): StatItem[] => {
    return [
      {
        key: "ticketsCreated",
        label: t("kpis.ticketsCreated"),
        value: data.kpis.ticketsCreatedCount,
      },
      {
        key: "callsLogged",
        label: t("kpis.callsLogged"),
        value: data.kpis.callsLoggedCount,
      },
      {
        key: "timelineNotes",
        label: t("kpis.timelineNotes"),
        value: data.kpis.notesCount,
      },
      {
        key: "casesResolved",
        label: t("kpis.casesResolved"),
        value: data.kpis.resolvedCount,
      },
    ];
  }, [data.kpis, t]);

  const actionLabel = (type: CommunityActivityActionType) =>
    t(`actionTypes.${type}` as "actionTypes.TICKET_OPENED");

  return (
    <div className="space-y-6">
      <div className={cn("space-y-1", entranceAnimationClass)}>
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          {teamView ? t("title") : t("titlePersonal")}
        </h2>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[220px] flex-1 space-y-2">
          <Label htmlFor="community-tracker-date">{t("selectDate")}</Label>
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  id="community-tracker-date"
                  type="button"
                  variant="outline"
                  disabled={pending}
                  className={cn(
                    "w-full justify-start text-start font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="size-4 opacity-60" />
                  {selectedDate
                    ? format(selectedDate, "PPP", { locale: dateLocale })
                    : "—"}
                </Button>
              }
            />
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                locale={dateLocale}
                onSelect={(date) => {
                  if (!date) return;
                  const next = format(date, "yyyy-MM-dd");
                  setDateInput(next);
                  refresh(next, agentFilter);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>

        {teamView ? (
          <div className="min-w-[220px] flex-1 space-y-2">
            <Label htmlFor="community-tracker-agent">{t("selectAgent")}</Label>
            <Select
              value={agentFilter}
              onValueChange={(value) => {
                const next = value ?? ALL_AGENTS;
                setAgentFilter(next);
                refresh(dateInput, next);
              }}
              disabled={pending}
            >
              <SelectTrigger id="community-tracker-agent" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_AGENTS}>{t("allAgents")}</SelectItem>
                {agentOptions.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {pending ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground pb-1">
            <Loader2 className="size-4 animate-spin" />
            {tCommon("loading")}
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <ExecutiveKpiGrid items={kpiItems} />

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("activityLog")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.activities.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("noActivity")}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.time")}</TableHead>
                    {teamView ? (
                      <TableHead>{t("columns.agent")}</TableHead>
                    ) : null}
                    <TableHead>{t("columns.action")}</TableHead>
                    <TableHead>{t("columns.unit")}</TableHead>
                    <TableHead className="min-w-[12rem]">
                      {t("columns.snippet")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.activities.map((row) => {
                    const Icon = ACTION_ICON[row.actionType];
                    const at = new Date(row.timestamp);
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap tabular-nums text-sm">
                          {format(at, "p", { locale: dateLocale })}
                        </TableCell>
                        {teamView ? (
                          <TableCell className="text-sm font-medium">
                            {row.agentName}
                          </TableCell>
                        ) : null}
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            <Icon className="size-3.5 shrink-0 opacity-70" />
                            {actionLabel(row.actionType)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/units/${row.unitId}?tab=timeline`}
                            className="font-medium text-primary hover:underline"
                          >
                            {row.unitCode}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-md truncate text-sm text-muted-foreground">
                          {row.snippet}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
