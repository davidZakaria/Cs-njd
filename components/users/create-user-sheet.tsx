"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

import { createUser } from "@/lib/actions/crm";
import type { CreateUserFormValues } from "@/lib/validations/user";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { useUserFormSchemas } from "@/hooks/use-user-form-schemas";
import { UserRoleSelect } from "@/components/users/user-role-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const defaultValues: CreateUserFormValues = {
  name: "",
  email: "",
  password: "",
  role: "CS_AGENT",
};

export function CreateUserSheet({
  open,
  onOpenChange,
  isSuperAdmin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSuperAdmin: boolean;
}) {
  const locale = useLocale();
  const isRtl = locale === "ar";
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  const tToast = useTranslations("users.toast");
  const router = useRouter();
  const { pending, runAction } = useCrudToast();
  const { createSchema } = useUserFormSchemas();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      reset(defaultValues);
    }
  }, [open, reset]);

  function onSubmit(values: CreateUserFormValues) {
    runAction(
      async () => {
        const result = await createUser(values);
        if (result.success) {
          onOpenChange(false);
          reset(defaultValues);
          router.refresh();
        }
        return result;
      },
      "created",
      tToast("userCreated")
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isRtl ? "left" : "right"}
        className="w-full border-border/50 bg-background/95 backdrop-blur-lg sm:max-w-md"
      >
        <SheetHeader className="border-b border-border/50 pb-4">
          <SheetTitle className="font-heading">{t("addNewUser")}</SheetTitle>
          <SheetDescription>{t("addNewUserDescription")}</SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-6 space-y-5"
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="create-user-name">{t("name")}</Label>
            <Input
              id="create-user-name"
              disabled={pending}
              autoComplete="name"
              aria-invalid={Boolean(errors.name)}
              className={cn(errors.name && "border-destructive")}
              {...register("name")}
            />
            {errors.name ? (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-user-email">{tCommon("email")}</Label>
            <Input
              id="create-user-email"
              type="email"
              disabled={pending}
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              className={cn(errors.email && "border-destructive")}
              {...register("email")}
            />
            {errors.email ? (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-user-password">{tCommon("password")}</Label>
            <Input
              id="create-user-password"
              type="password"
              disabled={pending}
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              className={cn(errors.password && "border-destructive")}
              {...register("password")}
            />
            {errors.password ? (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("passwordHint")}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-user-role">{t("role")}</Label>
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <UserRoleSelect
                  id="create-user-role"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={pending}
                  isSuperAdmin={isSuperAdmin}
                />
              )}
            />
            {errors.role ? (
              <p className="text-xs text-destructive">{errors.role.message}</p>
            ) : null}
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" className="flex-1" disabled={pending}>
              {pending ? tCommon("loading") : t("createUser")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
