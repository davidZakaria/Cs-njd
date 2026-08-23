"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { createTicket, updateTicketStatus } from "@/lib/actions/crm";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { useDomainLabels } from "@/hooks/use-domain-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TICKET_STATUSES = ["PENDING", "ENGINEERING", "LEGAL", "RESOLVED"] as const;
const PENDING_PARTIES = [
  "NONE",
  "CLIENT",
  "ENGINEERING",
  "LEGAL",
  "FINANCE",
  "MANAGEMENT",
  "LOGISTICS",
] as const;

type TicketRow = {
  id: string;
  notes: string;
  categoryLabel: string;
  statusLabel: string;
  status: string;
  pendingParty: string;
  pendingPartyLabel: string;
  nextFollowUpDate: string;
  agentLabel: string;
  createdAtLabel: string;
  displayNotes: string;
  canEdit: boolean;
};

function toDateInput(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function UnitTimelineCrud({
  unitId,
  tickets,
  statusItems,
  timelineLabel,
  noTicketsLabel,
  addFeedbackLabel,
  notesPlaceholder,
}: {
  unitId: string;
  tickets: TicketRow[];
  statusItems: Record<string, string>;
  timelineLabel: string;
  noTicketsLabel: string;
  addFeedbackLabel: string;
  notesPlaceholder: string;
}) {
  const tCommon = useTranslations("common");
  const tWorkflow = useTranslations("workflow");
  const labels = useDomainLabels();
  const { pending, notify } = useCrudToast();

  const partyItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const party of PENDING_PARTIES) {
      items[party] = labels.pendingParty(party);
    }
    return items;
  }, [labels]);

  async function handleCreate(formData: FormData) {
    notify(await createTicket(formData), "created");
  }

  async function handleUpdate(formData: FormData) {
    notify(await updateTicketStatus(formData), "saved");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle>{timelineLabel}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {tickets.length === 0 && (
            <p className="text-sm text-muted-foreground">{noTicketsLabel}</p>
          )}
          {tickets.map((ticket) => (
            <div key={ticket.id} className="rounded-lg border p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline">{ticket.categoryLabel}</Badge>
                <Badge variant="outline">{ticket.statusLabel}</Badge>
                {ticket.pendingParty !== "NONE" ? (
                  <Badge variant="secondary">{ticket.pendingPartyLabel}</Badge>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {ticket.createdAtLabel}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{ticket.displayNotes}</p>
              <p className="mt-2 text-xs text-muted-foreground">{ticket.agentLabel}</p>
              {ticket.nextFollowUpDate ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {tWorkflow("nextFollowUpDate")}: {ticket.nextFollowUpDate}
                </p>
              ) : null}
              {ticket.canEdit ? (
                <form action={handleUpdate} className="mt-3 space-y-3">
                  <input type="hidden" name="id" value={ticket.id} />
                  <div className="flex flex-wrap gap-2">
                    <Select
                      name="status"
                      defaultValue={ticket.status}
                      items={statusItems}
                      disabled={pending}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TICKET_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {statusItems[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      name="pendingParty"
                      defaultValue={ticket.pendingParty}
                      items={partyItems}
                      disabled={pending}
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue placeholder={tWorkflow("pendingParty")} />
                      </SelectTrigger>
                      <SelectContent>
                        {PENDING_PARTIES.map((party) => (
                          <SelectItem key={party} value={party}>
                            {partyItems[party]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`follow-up-${ticket.id}`} className="text-xs">
                      {tWorkflow("nextFollowUpDate")}
                    </Label>
                    <Input
                      id={`follow-up-${ticket.id}`}
                      name="nextFollowUpDate"
                      type="date"
                      defaultValue={toDateInput(ticket.nextFollowUpDate)}
                      disabled={pending}
                      className="w-44"
                    />
                  </div>
                  <Button type="submit" size="sm" disabled={pending}>
                    {tCommon("update")}
                  </Button>
                </form>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{addFeedbackLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleCreate} className="space-y-3">
            <input type="hidden" name="unitId" value={unitId} />
            <Textarea
              name="notes"
              placeholder={notesPlaceholder}
              required
              disabled={pending}
            />
            <Select
              name="status"
              defaultValue="PENDING"
              items={statusItems}
              disabled={pending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TICKET_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {statusItems[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              name="pendingParty"
              defaultValue="NONE"
              items={partyItems}
              disabled={pending}
            >
              <SelectTrigger>
                <SelectValue placeholder={tWorkflow("pendingParty")} />
              </SelectTrigger>
              <SelectContent>
                {PENDING_PARTIES.map((party) => (
                  <SelectItem key={party} value={party}>
                    {partyItems[party]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="space-y-1">
              <Label htmlFor="new-follow-up" className="text-xs">
                {tWorkflow("nextFollowUpDate")}
              </Label>
              <Input
                id="new-follow-up"
                name="nextFollowUpDate"
                type="date"
                disabled={pending}
              />
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {tCommon("save")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
