"use client";

import { useMemo, useState } from "react";
import { assignTicketAgent } from "@/lib/actions/crm";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function TicketAgentSelect({
  agentId,
  agentName,
  agents,
  unassignedLabel,
  formatStaffName,
}: {
  agentId: string | null;
  agentName: string;
  agents: Array<{ id: string; name: string }>;
  unassignedLabel: string;
  formatStaffName: (name: string) => string;
}) {
  const items = useMemo(() => {
    const map: Record<string, string> = { unassigned: unassignedLabel };
    for (const agent of agents) {
      map[agent.id] = formatStaffName(agent.name);
    }
    if (agentId && agentName && !map[agentId]) {
      map[agentId] = formatStaffName(agentName);
    }
    return map;
  }, [agentId, agentName, agents, formatStaffName, unassignedLabel]);

  const resolved = agentId && items[agentId] ? agentId : "unassigned";
  const [value, setValue] = useState(resolved);

  return (
    <>
      <input type="hidden" name="agentId" value={value} />
      <Select
        value={value}
        onValueChange={(next) => {
          if (next != null) setValue(next);
        }}
        items={items}
      >
        <SelectTrigger className="w-[11rem]">
          <SelectValue placeholder={unassignedLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unassigned">{unassignedLabel}</SelectItem>
          {agents.map((agent) => (
            <SelectItem key={agent.id} value={agent.id}>
              {formatStaffName(agent.name)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

export function TicketAgentAssignForm({
  ticketId,
  agentId,
  agentName,
  agents,
  assignLabel,
  unassignedLabel,
  formatStaffName,
}: {
  ticketId: string;
  agentId: string | null;
  agentName: string;
  agents: Array<{ id: string; name: string }>;
  assignLabel: string;
  unassignedLabel: string;
  formatStaffName: (name: string) => string;
}) {
  return (
    <form action={assignTicketAgent} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={ticketId} />
      <TicketAgentSelect
        key={`${ticketId}-${agentId ?? "unassigned"}`}
        agentId={agentId}
        agentName={agentName}
        agents={agents}
        unassignedLabel={unassignedLabel}
        formatStaffName={formatStaffName}
      />
      <Button type="submit" size="sm">
        {assignLabel}
      </Button>
    </form>
  );
}
