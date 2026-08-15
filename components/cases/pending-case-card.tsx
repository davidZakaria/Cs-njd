"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { updateTicketStatus } from "@/lib/actions/crm";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { isAwaitingResponseNote } from "@/lib/import/master-cases";
import { useDomainLabels } from "@/hooks/use-domain-labels";
import { TicketAgentAssignForm } from "@/components/cases/ticket-agent-assign-form";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TICKET_STATUSES = ["PENDING", "ENGINEERING", "LEGAL", "RESOLVED"] as const;

export type PendingCaseCardProps = {
  unitId: string;
  unitCode: string;
  project: string;
  clientName: string;
  clientPhone: string | null;
  unitAgent: string | null;
  openCount: number;
  ticketId: string;
  ticketAgentId?: string | null;
  ticketAgentName?: string | null;
  notes: string;
  category: string;
  status: string;
  canAssign?: boolean;
  agents?: Array<{ id: string; name: string }>;
};

export function PendingCaseCard({
  unitId,
  unitCode,
  project,
  clientName,
  clientPhone,
  unitAgent,
  openCount,
  ticketId,
  ticketAgentId = null,
  ticketAgentName = null,
  notes,
  category,
  status,
  canAssign = false,
  agents = [],
}: PendingCaseCardProps) {
  const t = useTranslations("cases.pendingWork");
  const tCases = useTranslations("cases");
  const labels = useDomainLabels();
  const [ticketStatus, setTicketStatus] = useState(status);

  const statusItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const s of TICKET_STATUSES) {
      items[s] = labels.ticketStatus(s);
    }
    return items;
  }, [labels]);

  const { pending, notify } = useCrudToast();

  async function handleUpdate(formData: FormData) {
    notify(await updateTicketStatus(formData), "saved");
  }

  const displayNotes = isAwaitingResponseNote(notes)
    ? tCases("awaitingResponse")
    : notes;

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/units/${unitId}?tab=timeline`}
            className="font-medium hover:underline"
          >
            {clientName}
          </Link>
          <Badge variant="outline">{labels.ticketCategory(category)}</Badge>
          <Badge variant="secondary">{labels.ticketStatus(status)}</Badge>
          {openCount > 1 && (
            <Badge variant="outline">{t("openCount", { count: openCount })}</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {labels.project(project)} · {unitCode}
          {clientPhone ? ` · ${clientPhone}` : ""}
          {unitAgent ? ` · ${labels.staffName(unitAgent)}` : ""}
        </p>
        <p className="line-clamp-2 text-sm text-muted-foreground" title={displayNotes}>
          {displayNotes}
        </p>
      </div>

      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
        {canAssign && agents.length > 0 && (
          <TicketAgentAssignForm
            ticketId={ticketId}
            agentId={ticketAgentId}
            agentName={ticketAgentName ?? ""}
            agents={agents}
            assignLabel={tCases("assign")}
            unassignedLabel={tCases("unassigned")}
            formatStaffName={labels.staffName}
          />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <form action={handleUpdate} className="flex items-center gap-2">
            <input type="hidden" name="id" value={ticketId} />
            <input type="hidden" name="status" value={ticketStatus} />
            <Select
              value={ticketStatus}
              onValueChange={(next) => {
                if (next != null) setTicketStatus(next);
              }}
              items={statusItems}
              disabled={pending}
            >
              <SelectTrigger className="w-[9rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TICKET_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusItems[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              {t("updateStatus")}
            </Button>
          </form>
          <Link
            href={`/units/${unitId}?tab=timeline`}
            className={cn(buttonVariants({ size: "sm", variant: "ghost" }))}
          >
            {t("openUnit")}
          </Link>
        </div>
      </div>
    </div>
  );
}
