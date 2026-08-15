"use client";

import { useTranslations } from "next-intl";
import { createTicket, updateTicketStatus } from "@/lib/actions/crm";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type TicketRow = {
  id: string;
  notes: string;
  categoryLabel: string;
  statusLabel: string;
  status: string;
  agentLabel: string;
  createdAtLabel: string;
  displayNotes: string;
  canEdit: boolean;
};

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
  const { pending, notify } = useCrudToast();

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
                <span className="text-xs text-muted-foreground">
                  {ticket.createdAtLabel}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{ticket.displayNotes}</p>
              <p className="mt-2 text-xs text-muted-foreground">{ticket.agentLabel}</p>
              {ticket.canEdit ? (
                <form action={handleUpdate} className="mt-3 flex gap-2">
                  <input type="hidden" name="id" value={ticket.id} />
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
            <Button type="submit" className="w-full" disabled={pending}>
              {tCommon("save")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
