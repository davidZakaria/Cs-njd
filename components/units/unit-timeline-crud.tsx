"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  createTicket,
  deleteTicket,
  logCallQuickAction,
  updateTicketDetails,
  updateTicketStatus,
} from "@/lib/actions/crm";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { useDomainLabels } from "@/hooks/use-domain-labels";
import {
  confirmManagementOverride,
  ManagementOverrideCheckbox,
} from "@/components/workflow/management-override-field";
import { TICKET_CATEGORIES } from "@/lib/validations/ticket";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  category: string;
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

function TicketUpdateForm({
  ticket,
  statusItems,
  partyItems,
  categoryItems,
  pending,
  canManageTickets,
  canUseManagementOverride,
  onSubmit,
  onDelete,
}: {
  ticket: TicketRow;
  statusItems: Record<string, string>;
  partyItems: Record<string, string>;
  categoryItems: Record<string, string>;
  pending: boolean;
  canManageTickets: boolean;
  canUseManagementOverride: boolean;
  onSubmit: (formData: FormData) => void | Promise<void>;
  onDelete: (ticketId: string) => void | Promise<void>;
}) {
  const t = useTranslations("units");
  const tCases = useTranslations("cases");
  const tCommon = useTranslations("common");
  const tWorkflow = useTranslations("workflow");
  const [status, setStatus] = useState(ticket.status);
  const [override, setOverride] = useState(false);

  async function handleSubmit(formData: FormData) {
    if (
      !confirmManagementOverride(
        status,
        override,
        tWorkflow("override.confirm")
      )
    ) {
      return;
    }
    await onSubmit(formData);
  }

  async function handleDelete() {
    if (!window.confirm(t("deleteTicketConfirm"))) return;
    await onDelete(ticket.id);
  }

  return (
    <form action={handleSubmit} className="mt-3 space-y-3">
      <input type="hidden" name="id" value={ticket.id} />
      <input type="hidden" name="status" value={status} />
      {canManageTickets ? (
        <>
          <div className="space-y-1">
            <Label htmlFor={`notes-${ticket.id}`} className="text-xs">
              {tCases("caseNotes")}
            </Label>
            <Textarea
              id={`notes-${ticket.id}`}
              name="notes"
              defaultValue={ticket.notes}
              rows={3}
              disabled={pending}
              required
            />
          </div>
          <Select
            name="category"
            defaultValue={ticket.category}
            items={categoryItems}
            disabled={pending}
          >
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TICKET_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {categoryItems[category]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Select
          value={status}
          onValueChange={(next) => {
            if (next != null) {
              setStatus(next);
              if (next !== "RESOLVED") setOverride(false);
            }
          }}
          items={statusItems}
          disabled={pending}
        >
          <SelectTrigger className="w-40">
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
      <ManagementOverrideCheckbox
        visible={canUseManagementOverride && status === "RESOLVED"}
        checked={override}
        onCheckedChange={setOverride}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {tCommon("update")}
        </Button>
        {canManageTickets ? (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={handleDelete}
          >
            {tCommon("delete")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function UnitTimelineCrud({
  unitId,
  tickets,
  statusItems,
  timelineLabel,
  noTicketsLabel,
  addFeedbackLabel,
  notesPlaceholder,
  canManageTickets = false,
  canUseManagementOverride = false,
}: {
  unitId: string;
  tickets: TicketRow[];
  statusItems: Record<string, string>;
  timelineLabel: string;
  noTicketsLabel: string;
  addFeedbackLabel: string;
  notesPlaceholder: string;
  canManageTickets?: boolean;
  canUseManagementOverride?: boolean;
}) {
  const t = useTranslations("units");
  const tCases = useTranslations("cases");
  const tCommon = useTranslations("common");
  const tActions = useTranslations("actions");
  const tWorkflow = useTranslations("workflow");
  const labels = useDomainLabels();
  const { pending, notify, runAction } = useCrudToast();
  const [logCallOpen, setLogCallOpen] = useState(false);
  const [callNotes, setCallNotes] = useState("📞 ");

  const partyItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const party of PENDING_PARTIES) {
      items[party] = labels.pendingParty(party);
    }
    return items;
  }, [labels]);

  const categoryItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const category of TICKET_CATEGORIES) {
      items[category] = labels.ticketCategory(category);
    }
    return items;
  }, [labels]);

  async function handleCreate(formData: FormData) {
    notify(await createTicket(formData), "created");
  }

  async function handleUpdate(formData: FormData) {
    const result = canManageTickets
      ? await updateTicketDetails(formData)
      : await updateTicketStatus(formData);
    notify(result, "saved");
  }

  async function handleDelete(ticketId: string) {
    notify(await deleteTicket(ticketId), "deleted");
  }

  function handleLogCall() {
    runAction(
      () =>
        logCallQuickAction({
          unitId,
          notes: callNotes.trim(),
        }),
      "created",
      tWorkflow("logCall")
    );
    setCallNotes("📞 ");
    setLogCallOpen(false);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>{timelineLabel}</CardTitle>
          <Dialog open={logCallOpen} onOpenChange={setLogCallOpen}>
            <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>
              {tWorkflow("logCall")}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{tWorkflow("logCall")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="log-call-notes">{tCases("caseNotes")}</Label>
                <Textarea
                  id="log-call-notes"
                  value={callNotes}
                  onChange={(event) => setCallNotes(event.target.value)}
                  rows={4}
                  disabled={pending}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLogCallOpen(false)}
                  disabled={pending}
                >
                  {tCommon("cancel")}
                </Button>
                <Button
                  type="button"
                  onClick={handleLogCall}
                  disabled={pending || !callNotes.trim()}
                >
                  {tActions("logCall")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
                <TicketUpdateForm
                  ticket={ticket}
                  statusItems={statusItems}
                  partyItems={partyItems}
                  categoryItems={categoryItems}
                  pending={pending}
                  canManageTickets={canManageTickets}
                  canUseManagementOverride={canUseManagementOverride}
                  onSubmit={handleUpdate}
                  onDelete={handleDelete}
                />
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
            {canManageTickets ? (
              <Select
                name="category"
                defaultValue="GENERAL"
                items={categoryItems}
                disabled={pending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {categoryItems[category]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
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
