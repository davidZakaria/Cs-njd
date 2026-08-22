import { Role } from "@prisma/client";
import { z } from "zod";

const roleValues = Object.values(Role) as [Role, ...Role[]];

export const userRoleSchema = z.enum(roleValues);

export const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Invalid email address")
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters"),
  role: userRoleSchema,
});

export const updateUserSchema = z.object({
  id: z.string().min(1, "User id is required"),
  name: z.string().trim().min(1, "Name is required"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Invalid email address")
    .transform((value) => value.toLowerCase()),
  role: userRoleSchema,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export type UserFormMessages = {
  nameRequired: string;
  emailRequired: string;
  emailInvalid: string;
  passwordRequired: string;
  passwordMin: string;
};

export function createUserFormSchema(messages: UserFormMessages) {
  return z.object({
    name: z.string().trim().min(1, messages.nameRequired),
    email: z
      .string()
      .trim()
      .min(1, messages.emailRequired)
      .email(messages.emailInvalid)
      .transform((value) => value.toLowerCase()),
    password: z.string().min(8, messages.passwordMin),
    role: userRoleSchema,
  });
}

export function updateUserFormSchema(messages: Omit<UserFormMessages, "passwordRequired" | "passwordMin">) {
  return z.object({
    name: z.string().trim().min(1, messages.nameRequired),
    email: z
      .string()
      .trim()
      .min(1, messages.emailRequired)
      .email(messages.emailInvalid)
      .transform((value) => value.toLowerCase()),
    role: userRoleSchema,
  });
}

export type CreateUserFormValues = z.input<ReturnType<typeof createUserFormSchema>>;
export type UpdateUserFormValues = z.input<ReturnType<typeof updateUserFormSchema>>;
