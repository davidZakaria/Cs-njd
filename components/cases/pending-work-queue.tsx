import { getLocale, getTranslations } from "next-intl/server";

import type { PendingWorkUnit } from "@/lib/cases/pending-work";
import {
  groupPendingWorkByProject,
  sortPendingWorkProjectKeys,
} from "@/lib/cases/pending-work";
import { CsPendingWorkDashboard } from "@/components/cases/cs-pending-work-dashboard";
import { PendingCaseCard } from "@/components/cases/pending-case-card";
import { Card, CardContent } from "@/components/ui/card";
import { getDomainLabels } from "@/lib/i18n/domain-labels";

type AgentOption = { id: string; name: string };

function PendingWorkSection({
  items,
  empty,
  canAssign,
  agents,
}: {
  items: PendingWorkUnit[];
  empty: string;
  canAssign?: boolean;
  agents?: AgentOption[];
}) {
  if (items.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">{empty}</p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <PendingCaseCard
          key={item.unitId}
          unitId={item.unitId}
          unitCode={item.unitCode}
          project={item.project}
          clientName={item.clientName}
          clientPhone={item.clientPhone}
          unitAgent={item.unitAgent}
          openCount={item.openCount}
          ticketId={item.primaryTicket.id}
          ticketAgentId={item.primaryTicket.agentId}
          ticketAgentName={item.primaryTicket.agentName}
          notes={item.primaryTicket.notes}
          category={item.primaryTicket.category}
          status={item.primaryTicket.status}
          workflowKey={item.primaryTicket.workflowKey}
          canAssign={canAssign}
          agents={agents}
        />
      ))}
    </div>
  );
}

export async function PendingWorkQueue({
  items,
  mine,
  team,
  teamAgents,
  groupByProject = false,
}: {
  items?: PendingWorkUnit[];
  mine?: PendingWorkUnit[];
  team?: PendingWorkUnit[];
  teamAgents?: AgentOption[];
  groupByProject?: boolean;
}) {
  const t = await getTranslations("cases.pendingWork");
  const tManager = await getTranslations("cases.manager");

  if (mine != null && team != null) {
    const hasAny = mine.length > 0 || team.length > 0;

    if (!hasAny) {
      return (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            {t("empty")}
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        {team.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">
              {tManager("teamCases.pendingTitle")}
            </h2>
            <PendingWorkSection
              items={team}
              empty={tManager("teamCases.pendingEmpty")}
              canAssign={Boolean(teamAgents?.length)}
              agents={teamAgents}
            />
          </section>
        )}
        {mine.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">
              {tManager("myCases.pendingTitle")}
            </h2>
            <PendingWorkSection
              items={mine}
              empty={tManager("myCases.pendingEmpty")}
            />
          </section>
        )}
      </div>
    );
  }

  const list = items ?? [];

  if (list.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          {t("empty")}
        </CardContent>
      </Card>
    );
  }

  if (groupByProject) {
    const locale = await getLocale();
    const labels = await getDomainLabels(locale);
    const grouped = groupPendingWorkByProject(list);
    const projectKeys = sortPendingWorkProjectKeys([...grouped.keys()]);
    const groups = await Promise.all(
      projectKeys.map(async (projectKey) => {
        const projectItems = grouped.get(projectKey) ?? [];
        return {
          projectKey,
          projectLabel: await labels.project(projectKey),
          unitCount: projectItems.length,
          openCaseCount: projectItems.reduce(
            (sum, item) => sum + item.openCount,
            0
          ),
          items: projectItems,
        };
      })
    );

    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("subtitleCalm")}</p>
        </div>
        <CsPendingWorkDashboard groups={groups} />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      <PendingWorkSection items={list} empty={t("empty")} />
    </section>
  );
}
