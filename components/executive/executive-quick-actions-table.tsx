"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { updateTicketStatus } from "@/lib/actions/crm";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { isAwaitingResponseNote } from "@/lib/import/master-cases";
import type { ExecutiveCaseRow } from "@/lib/cases/executive-dashboard";
import { useDomainLabels } from "@/hooks/use-domain-labels";
import { TicketAgentAssignForm } from "@/components/cases/ticket-agent-assign-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

const TICKET_STATUSES = ["PENDING", "ENGINEERING", "LEGAL", "RESOLVED"] as const;

function StatusQuickForm({
  ticketId,
  status,
  statusItems,
  saveLabel,
  isRtl,
}: {
  ticketId: string;
  status: string;
  statusItems: Record<string, string>;
  saveLabel: string;
  isRtl: boolean;
}) {
  const [value, setValue] = useState(status);
  const { pending, notify } = useCrudToast();

  async function handleUpdate(formData: FormData) {
    notify(await updateTicketStatus(formData), "saved");
  }

  return (
    <form
      action={handleUpdate}
      className={cn(
        "flex min-w-[10.5rem] items-center gap-1.5",
        isRtl ? "flex-row-reverse justify-end" : "justify-start"
      )}
    >
      <input type="hidden" name="id" value={ticketId} />
      <input type="hidden" name="status" value={value} />
      <Select
        value={value}
        onValueChange={(next) => {
          if (next != null) setValue(next);
        }}
        items={statusItems}
        disabled={pending}
      >
        <SelectTrigger className="h-8 w-[7.5rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TICKET_STATUSES.map((item) => (
            <SelectItem key={item} value={item}>
              {statusItems[item]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="submit"
        size="sm"
        variant="outline"
        className="h-8 shrink-0"
        disabled={pending}
      >
        {saveLabel}
      </Button>
    </form>
  );
}

export function ExecutiveQuickActionsTable({
  rows,
  agents,
  canAssign,
  emptyLabel,
}: {
  rows: ExecutiveCaseRow[];
  agents: Array<{ id: string; name: string }>;
  canAssign: boolean;
  emptyLabel: string;
}) {
  const locale = useLocale();
  const isRtl = locale === "ar";
  const t = useTranslations("cases");
  const tExec = useTranslations("executive");
  const tCommon = useTranslations("common");
  const labels = useDomainLabels();

  const statusItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const status of TICKET_STATUSES) {
      items[status] = labels.ticketStatus(status);
    }
    return items;
  }, [labels]);

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>
    );
  }

  return (
    <Table className="min-w-[920px]">
      <TableHeader>
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableHead className="min-w-[9rem] ps-4 text-start">
            {t("client")}
          </TableHead>
          <TableHead className="min-w-[10rem] text-start">{t("unit")}</TableHead>
          <TableHead className="min-w-[7rem] text-start">{t("status")}</TableHead>
          <TableHead className="min-w-[14rem] text-start">{t("caseNotes")}</TableHead>
          {canAssign ? (
            <TableHead className="min-w-[11rem] text-start">
              {t("assignToCs")}
            </TableHead>
          ) : null}
          <TableHead className="min-w-[11rem] pe-4 text-start">
            {tCommon("actions")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const notes = isAwaitingResponseNote(row.notes)
            ? t("awaitingResponse")
            : row.notes;

          return (
            <TableRow key={row.id}>
              <TableCell className="max-w-[12rem] ps-4 font-medium">
                <span className="line-clamp-2 whitespace-normal">{row.client}</span>
              </TableCell>
              <TableCell className="max-w-[14rem]">
                <Link
                  href={`/units/${row.unitId}?tab=timeline`}
                  className="whitespace-normal hover:underline"
                >
                  {labels.project(row.project)} · {row.unitCode}
                </Link>
              </TableCell>
              <TableCell>
                <div className="flex flex-col items-start gap-1">
                  <Badge variant="secondary">
                    {labels.ticketStatus(row.status)}
                  </Badge>
                  <Badge variant="outline">
                    {labels.ticketCategory(row.category)}
                  </Badge>
                  {row.pendingParty !== "NONE" ? (
                    <Badge variant="secondary">
                      {labels.pendingParty(row.pendingParty)}
                    </Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="max-w-sm whitespace-normal">
                <p
                  className="line-clamp-3 text-sm text-muted-foreground"
                  title={notes}
                  dir="auto"
                >
                  {notes}
                </p>
                {row.agentName ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {labels.staffName(row.agentName)}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    {t("unassigned")}
                  </p>
                )}
              </TableCell>
              {canAssign ? (
                <TableCell className="align-top">
                  <TicketAgentAssignForm
                    ticketId={row.id}
                    agentId={row.agentId}
                    agentName={row.agentName}
                    agents={agents}
                    assignLabel={t("assign")}
                    unassignedLabel={t("unassigned")}
                    formatStaffName={labels.staffName}
                  />
                </TableCell>
              ) : null}
              <TableCell className="pe-4 align-top">
                <StatusQuickForm
                  ticketId={row.id}
                  status={row.status}
                  statusItems={statusItems}
                  saveLabel={tExec("saveStatus")}
                  isRtl={isRtl}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
