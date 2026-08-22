"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import {
  createUserFormSchema,
  updateUserFormSchema,
} from "@/lib/validations/user";

export function useUserFormSchemas() {
  const t = useTranslations("users.validation");

  const messages = useMemo(
    () => ({
      nameRequired: t("nameRequired"),
      emailRequired: t("emailRequired"),
      emailInvalid: t("emailInvalid"),
      passwordRequired: t("passwordRequired"),
      passwordMin: t("passwordMin"),
    }),
    [t]
  );

  const createSchema = useMemo(
    () => createUserFormSchema(messages),
    [messages]
  );

  const updateSchema = useMemo(
    () =>
      updateUserFormSchema({
        nameRequired: messages.nameRequired,
        emailRequired: messages.emailRequired,
        emailInvalid: messages.emailInvalid,
      }),
    [messages]
  );

  return { createSchema, updateSchema };
}
