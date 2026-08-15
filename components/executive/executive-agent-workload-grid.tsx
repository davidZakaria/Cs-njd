import type { AgentWorkload } from "@/lib/cases/executive-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type WorkloadLabels = {
  openTotal: string;
  pending: string;
  legal: string;
  engineering: string;
};

export function ExecutiveAgentWorkloadGrid({
  agents,
  title,
  labels,
}: {
  agents: AgentWorkload[];
  title: string;
  labels: WorkloadLabels;
}) {
  if (agents.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {agents.map((agent) => (
          <Card
            key={agent.agentId ?? "unassigned"}
            className="bg-card/80 shadow-sm transition-shadow hover:shadow-md"
          >
            <CardHeader className="pb-2">
              <CardTitle className="truncate text-base">{agent.agentName}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">{labels.openTotal}</p>
                <p className="text-xl font-semibold tabular-nums">
                  {agent.openCount}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{labels.pending}</p>
                <p className="text-xl font-semibold tabular-nums">
                  {agent.pendingCount}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{labels.legal}</p>
                <p className="text-xl font-semibold tabular-nums text-[var(--color-chart-3)]">
                  {agent.legalCount}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{labels.engineering}</p>
                <p className="text-xl font-semibold tabular-nums text-[var(--color-chart-4)]">
                  {agent.engineeringCount}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
