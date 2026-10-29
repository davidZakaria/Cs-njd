"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateProjectUnitCycleSettingsAction } from "@/lib/actions/unit-cycle";

export type ProjectUnitCycleSettings = {
  projectId: string;
  projectName: string;
  unitCycleEnabled: boolean;
  unitCycleContractDeadlineDays: number;
  unitCycleFinanceDeadlineDays: number;
  unitCycleEngineeringDeadlineDays: number;
  unitCycleLegalHandoverDeadlineDays: number;
};

export function ProjectUnitCycleSettingsPanel({
  projects,
}: {
  projects: ProjectUnitCycleSettings[];
}) {
  return (
    <div className="space-y-6">
      {projects.map((project) => (
        <ProjectSettingsForm key={project.projectId} project={project} />
      ))}
    </div>
  );
}

function ProjectSettingsForm({
  project,
}: {
  project: ProjectUnitCycleSettings;
}) {
  const t = useTranslations("unitCycle.projectSettings");
  const [enabled, setEnabled] = useState(project.unitCycleEnabled);
  const [pending, startTransition] = useTransition();

  return (
        <form
          className="space-y-4 rounded-xl border bg-card p-4 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            startTransition(async () => {
              await updateProjectUnitCycleSettingsAction({
                projectId: project.projectId,
                unitCycleEnabled: enabled,
                unitCycleContractDeadlineDays: Number(
                  data.get("contractDays") ?? project.unitCycleContractDeadlineDays
                ),
                unitCycleFinanceDeadlineDays: Number(
                  data.get("financeDays") ?? project.unitCycleFinanceDeadlineDays
                ),
                unitCycleEngineeringDeadlineDays: Number(
                  data.get("engineeringDays") ??
                    project.unitCycleEngineeringDeadlineDays
                ),
                unitCycleLegalHandoverDeadlineDays: Number(
                  data.get("legalDays") ?? project.unitCycleLegalHandoverDeadlineDays
                ),
              });
            });
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-lg font-semibold">{project.projectName}</h2>
              <p className="text-sm text-muted-foreground">{t("hint")}</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id={`enabled-${project.projectId}`}
                checked={enabled}
                onCheckedChange={setEnabled}
              />
              <Label htmlFor={`enabled-${project.projectId}`}>{t("enabled")}</Label>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DeadlineField
              name="contractDays"
              label={t("contractDays")}
              defaultValue={project.unitCycleContractDeadlineDays}
            />
            <DeadlineField
              name="financeDays"
              label={t("financeDays")}
              defaultValue={project.unitCycleFinanceDeadlineDays}
            />
            <DeadlineField
              name="engineeringDays"
              label={t("engineeringDays")}
              defaultValue={project.unitCycleEngineeringDeadlineDays}
            />
            <DeadlineField
              name="legalDays"
              label={t("legalDays")}
              defaultValue={project.unitCycleLegalHandoverDeadlineDays}
            />
          </div>
          <Button type="submit" disabled={pending}>
            {t("save")}
          </Button>
        </form>
  );
}

function DeadlineField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: number;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type="number"
        min={1}
        max={90}
        defaultValue={defaultValue}
      />
    </div>
  );
}
