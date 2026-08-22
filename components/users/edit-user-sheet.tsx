"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

import { updateUser } from "@/lib/actions/crm";
import type { UpdateUserFormValues } from "@/lib/validations/user";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { useUserFormSchemas } from "@/hooks/use-user-form-schemas";
import type { UserRow } from "@/components/users/types";
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

export function EditUserSheet({
  user,
  open,
  onOpenChange,
  isSuperAdmin,
}: {
  user: UserRow;
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
  const { updateSchema } = useUserFormSchemas();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<UpdateUserFormValues>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: user.name,
        email: user.email,
        role: user.role,
      });
    }
  }, [open, user, reset]);

  function onSubmit(values: UpdateUserFormValues) {
    runAction(
      async () => {
        const result = await updateUser({
          id: user.id,
          ...values,
        });
        if (result.success) {
          onOpenChange(false);
          router.refresh();
        }
        return result;
      },
      "saved",
      tToast("userUpdated")
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isRtl ? "left" : "right"}
        className="w-full border-border/50 bg-background/95 backdrop-blur-lg sm:max-w-md"
      >
        <SheetHeader className="border-b border-border/50 pb-4">
          <SheetTitle className="font-heading">{t("editDetails")}</SheetTitle>
          <SheetDescription>{t("editUserDescription")}</SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-6 space-y-5"
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor={`edit-user-name-${user.id}`}>{t("name")}</Label>
            <Input
              id={`edit-user-name-${user.id}`}
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
            <Label htmlFor={`edit-user-email-${user.id}`}>
              {tCommon("email")}
            </Label>
            <Input
              id={`edit-user-email-${user.id}`}
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
            <Label htmlFor={`edit-user-role-${user.id}`}>{t("role")}</Label>
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <UserRoleSelect
                  id={`edit-user-role-${user.id}`}
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
              {pending ? tCommon("loading") : tCommon("save")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
