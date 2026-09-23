"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

import { createUnit } from "@/lib/actions/units";
import {
  createUnitFormSchema,
  UNIT_TYPE_OPTIONS,
  type CreateUnitFormInput,
} from "@/lib/validations/unit-profile";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { useDomainLabels } from "@/hooks/use-domain-labels";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const defaultValues: CreateUnitFormInput = {
  projectId: "",
  unitCode: "",
  type: "APARTMENT",
  clientName: "",
  phone1: "",
  phone2: "",
  email: "",
  nationalId: "",
  address1: "",
  address2: "",
  area: "",
  contractPricePerMeter: "",
  agentId: "",
};

export function CreateUnitDialog({
  projects,
  agents,
}: {
  projects: Array<{ id: string; name: string }>;
  agents: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations("units");
  const tCommon = useTranslations("common");
  const labels = useDomainLabels();
  const router = useRouter();
  const { pending, runAction } = useCrudToast();
  const [open, setOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
  } = useForm<CreateUnitFormInput>({
    resolver: zodResolver(createUnitFormSchema),
    defaultValues,
  });

  const typeItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const value of UNIT_TYPE_OPTIONS) {
      items[value] = labels.unitType(value);
    }
    return items;
  }, [labels]);

  const projectItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const project of projects) {
      items[project.id] = labels.project(project.name);
    }
    return items;
  }, [labels, projects]);

  function onSubmit(values: CreateUnitFormInput) {
    runAction(async () => {
      const result = await createUnit(values);
      if (result.success) {
        setOpen(false);
        reset(defaultValues);
        router.refresh();
      }
      return result;
    }, "created");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" className="w-full lg:w-auto" />}>
        <Plus className="size-4" />
        {t("addUnit")}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("addUnit")}</DialogTitle>
          <DialogDescription>{t("addUnitDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="create-project">{t("project")}</Label>
              <Controller
                control={control}
                name="projectId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    items={projectItems}
                    disabled={pending}
                  >
                    <SelectTrigger id="create-project" className="w-full">
                      <SelectValue placeholder={t("project")} />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {labels.project(project.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-unitCode">{t("unitCode")}</Label>
              <Input
                id="create-unitCode"
                disabled={pending}
                required
                {...register("unitCode")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("type")}</Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    items={typeItems}
                    disabled={pending}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_TYPE_OPTIONS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {labels.unitType(value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="create-clientName">{t("client")}</Label>
              <Input
                id="create-clientName"
                disabled={pending}
                required
                {...register("clientName")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-phone1">{t("phone1")}</Label>
              <Input id="create-phone1" disabled={pending} {...register("phone1")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-phone2">{t("phone2")}</Label>
              <Input id="create-phone2" disabled={pending} {...register("phone2")} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="create-address1">{t("address1")}</Label>
              <Input id="create-address1" disabled={pending} {...register("address1")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-area">{t("area")}</Label>
              <Input
                id="create-area"
                type="number"
                step="any"
                min="0"
                disabled={pending}
                {...register("area")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("agent")}</Label>
              <Controller
                control={control}
                name="agentId"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    disabled={pending}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={labels.unassigned} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">{labels.unassigned}</SelectItem>
                      {agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {labels.staffName(agent.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {tCommon("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
