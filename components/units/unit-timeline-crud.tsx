"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Trash2 } from "lucide-react";
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
import { cn } from "@/lib/utils";

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

function formatFollowUpLabel(value: string, locale: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale);
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function CsQuickUpdateForm({
  ticket,
  statusItems,
  partyItems,
  pending,
  canUseManagementOverride,
  onSubmit,
}: {
  ticket: TicketRow;
  statusItems: Record<string, string>;
  partyItems: Record<string, string>;
  pending: boolean;
  canUseManagementOverride: boolean;
  onSubmit: (formData: FormData) => void | Promise<void>;
}) {
  const tCommon = useTranslations("common");
  const tCases = useTranslations("cases");
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

  return (
    <form
      action={handleSubmit}
      className="mt-3 flex flex-wrap items-end gap-2 border-t border-border/60 pt-3"
    >
      <input type="hidden" name="id" value={ticket.id} />
      <input type="hidden" name="status" value={status} />
      <Field label={tWorkflow("pendingParty")} className="min-w-[9rem] flex-1">
        <Select
          name="pendingParty"
          defaultValue={ticket.pendingParty}
          items={partyItems}
          disabled={pending}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PENDING_PARTIES.map((party) => (
              <SelectItem key={party} value={party}>
                {partyItems[party]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label={tCases("status")} className="min-w-[8rem]">
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
          <SelectTrigger className="h-9">
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
      </Field>
      <Field label={tWorkflow("nextFollowUpDate")} className="min-w-[9.5rem]">
        <Input
          name="nextFollowUpDate"
          type="date"
          defaultValue={toDateInput(ticket.nextFollowUpDate)}
          disabled={pending}
          className="h-9"
        />
      </Field>
      <Button type="submit" size="sm" className="h-9" disabled={pending}>
        {tCommon("save")}
      </Button>
      <ManagementOverrideCheckbox
        visible={canUseManagementOverride && status === "RESOLVED"}
        checked={override}
        onCheckedChange={setOverride}
      />
    </form>
  );
}

function ManagementEditForm({
  ticket,
  statusItems,
  partyItems,
  categoryItems,
  pending,
  canUseManagementOverride,
  onSubmit,
  onDelete,
  onCancel,
}: {
  ticket: TicketRow;
  statusItems: Record<string, string>;
  partyItems: Record<string, string>;
  categoryItems: Record<string, string>;
  pending: boolean;
  canUseManagementOverride: boolean;
  onSubmit: (formData: FormData) => void | Promise<void>;
  onDelete: (ticketId: string) => void | Promise<void>;
  onCancel: () => void;
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
    <form
      action={handleSubmit}
      className="mt-3 space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3"
    >
      <input type="hidden" name="id" value={ticket.id} />
      <input type="hidden" name="status" value={status} />

      <Field label={tCases("caseNotes")}>
        <Textarea
          name="notes"
          defaultValue={ticket.notes}
          rows={4}
          disabled={pending}
          required
          className="min-h-[5rem] resize-y bg-background"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={tCases("category")}>
          <Select
            name="category"
            defaultValue={ticket.category}
            items={categoryItems}
            disabled={pending}
          >
            <SelectTrigger className="h-9 bg-background">
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
        </Field>
        <Field label={tCases("status")}>
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
            <SelectTrigger className="h-9 bg-background">
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
        </Field>
        <Field label={tWorkflow("pendingParty")}>
          <Select
            name="pendingParty"
            defaultValue={ticket.pendingParty}
            items={partyItems}
            disabled={pending}
          >
            <SelectTrigger className="h-9 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PENDING_PARTIES.map((party) => (
                <SelectItem key={party} value={party}>
                  {partyItems[party]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={tWorkflow("nextFollowUpDate")}>
          <Input
            name="nextFollowUpDate"
            type="date"
            defaultValue={toDateInput(ticket.nextFollowUpDate)}
            disabled={pending}
            className="h-9 bg-background"
          />
        </Field>
      </div>

      <ManagementOverrideCheckbox
        visible={canUseManagementOverride && status === "RESOLVED"}
        checked={override}
        onCheckedChange={setOverride}
      />

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/40 pt-3">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={onCancel}
        >
          {tCommon("cancel")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          disabled={pending}
          onClick={handleDelete}
        >
          <Trash2 className="size-3.5" />
          {tCommon("delete")}
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {tCommon("save")}
        </Button>
      </div>
    </form>
  );
}

function TicketCard({
  ticket,
  statusItems,
  partyItems,
  categoryItems,
  pending,
  canManageTickets,
  canUseManagementOverride,
  isEditing,
  onEdit,
  onCancelEdit,
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
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSubmit: (formData: FormData) => void | Promise<void>;
  onDelete: (ticketId: string) => void | Promise<void>;
}) {
  const locale = useLocale();
  const tCommon = useTranslations("common");
  const tCases = useTranslations("cases");
  const tWorkflow = useTranslations("workflow");

  const followUpLabel = formatFollowUpLabel(ticket.nextFollowUpDate, locale);

  return (
    <article className="rounded-xl border border-border/70 bg-card/40 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="font-normal">
            {ticket.categoryLabel}
          </Badge>
          <Badge variant="secondary" className="font-normal">
            {ticket.statusLabel}
          </Badge>
          {ticket.pendingParty !== "NONE" ? (
            <Badge variant="outline" className="font-normal">
              {ticket.pendingPartyLabel}
            </Badge>
          ) : null}
        </div>
        <time className="text-xs text-muted-foreground">{ticket.createdAtLabel}</time>
      </div>

      {!isEditing ? (
        <>
          <p
            className="mt-3 whitespace-pre-wrap text-sm leading-relaxed"
            dir="auto"
          >
            {ticket.displayNotes}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{ticket.agentLabel}</span>
            {followUpLabel ? (
              <>
                <span aria-hidden>·</span>
                <span>
                  {tWorkflow("nextFollowUpDate")}: {followUpLabel}
                </span>
              </>
            ) : null}
          </div>
          {ticket.canEdit && canManageTickets ? (
            <div className="mt-3 flex justify-end gap-2 border-t border-border/40 pt-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={onEdit}
              >
                <Pencil className="size-3.5" />
                {tCommon("edit")}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}

      {ticket.canEdit && canManageTickets && isEditing ? (
        <ManagementEditForm
          ticket={ticket}
          statusItems={statusItems}
          partyItems={partyItems}
          categoryItems={categoryItems}
          pending={pending}
          canUseManagementOverride={canUseManagementOverride}
          onSubmit={onSubmit}
          onDelete={onDelete}
          onCancel={onCancelEdit}
        />
      ) : null}

      {ticket.canEdit && !canManageTickets ? (
        <CsQuickUpdateForm
          ticket={ticket}
          statusItems={statusItems}
          partyItems={partyItems}
          pending={pending}
          canUseManagementOverride={canUseManagementOverride}
          onSubmit={onSubmit}
        />
      ) : null}
    </article>
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
  contactDisabled = false,
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
  contactDisabled?: boolean;
}) {
  const tCases = useTranslations("cases");
  const tCommon = useTranslations("common");
  const tActions = useTranslations("actions");
  const tWorkflow = useTranslations("workflow");
  const tEdge = useTranslations("workflow.edgeCases");
  const labels = useDomainLabels();
  const { pending, notify, runAction } = useCrudToast();
  const [logCallOpen, setLogCallOpen] = useState(false);
  const [callNotes, setCallNotes] = useState("📞 ");
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);

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
    if (result.success) {
      setEditingTicketId(null);
    }
    notify(result, "saved");
  }

  async function handleDelete(ticketId: string) {
    const result = await deleteTicket(ticketId);
    if (result.success) {
      setEditingTicketId(null);
    }
    notify(result, "deleted");
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
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="text-lg">{timelineLabel}</CardTitle>
          <Dialog open={logCallOpen} onOpenChange={setLogCallOpen}>
            <DialogTrigger
              render={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={contactDisabled}
                  title={contactDisabled ? tEdge("lawsuitWarning") : undefined}
                />
              }
            >
              {tWorkflow("logCall")}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{tWorkflow("logCall")}</DialogTitle>
              </DialogHeader>
              <Field label={tCases("caseNotes")}>
                <Textarea
                  value={callNotes}
                  onChange={(event) => setCallNotes(event.target.value)}
                  rows={4}
                  disabled={pending}
                />
              </Field>
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
        <CardContent className="space-y-3">
          {tickets.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {noTicketsLabel}
            </p>
          )}
          {tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              statusItems={statusItems}
              partyItems={partyItems}
              categoryItems={categoryItems}
              pending={pending}
              canManageTickets={canManageTickets}
              canUseManagementOverride={canUseManagementOverride}
              isEditing={editingTicketId === ticket.id}
              onEdit={() => setEditingTicketId(ticket.id)}
              onCancelEdit={() => setEditingTicketId(null)}
              onSubmit={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </CardContent>
      </Card>

      <Card className="h-fit shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{addFeedbackLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleCreate} className="space-y-3">
            <input type="hidden" name="unitId" value={unitId} />
            <Field label={tCases("caseNotes")}>
              <Textarea
                name="notes"
                placeholder={notesPlaceholder}
                required
                disabled={pending}
                rows={4}
                className="min-h-[5rem] resize-y"
              />
            </Field>
            <div className="grid gap-3">
              {canManageTickets ? (
                <Field label={tCases("category")}>
                  <Select
                    name="category"
                    defaultValue="GENERAL"
                    items={categoryItems}
                    disabled={pending}
                  >
                    <SelectTrigger className="h-9">
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
                </Field>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <Field label={tCases("status")}>
                  <Select
                    name="status"
                    defaultValue="PENDING"
                    items={statusItems}
                    disabled={pending}
                  >
                    <SelectTrigger className="h-9">
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
                </Field>
                <Field label={tWorkflow("pendingParty")}>
                  <Select
                    name="pendingParty"
                    defaultValue="NONE"
                    items={partyItems}
                    disabled={pending}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PENDING_PARTIES.map((party) => (
                        <SelectItem key={party} value={party}>
                          {partyItems[party]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label={tWorkflow("nextFollowUpDate")}>
                <Input
                  name="nextFollowUpDate"
                  type="date"
                  disabled={pending}
                  className="h-9"
                />
              </Field>
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
