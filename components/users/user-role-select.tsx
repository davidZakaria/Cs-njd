"use client";

import type { Role } from "@prisma/client";
import { useTranslations } from "next-intl";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function UserRoleSelect({
  id,
  value,
  onChange,
  disabled,
  isSuperAdmin,
}: {
  id: string;
  value: Role;
  onChange: (role: Role) => void;
  disabled?: boolean;
  isSuperAdmin: boolean;
}) {
  const t = useTranslations("users");

  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as Role)}
      disabled={disabled}
    >
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="CS_AGENT">{t("roles.csAgent")}</SelectItem>
        {isSuperAdmin ? (
          <>
            <SelectItem value="MANAGEMENT">{t("roles.management")}</SelectItem>
            <SelectItem value="SUPER_ADMIN">{t("roles.superAdmin")}</SelectItem>
          </>
        ) : null}
      </SelectContent>
    </Select>
  );
}
