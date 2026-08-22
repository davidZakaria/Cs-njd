import type { Role } from "@prisma/client";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  is2FAEnabled: boolean;
  hasTwoFactorSecret: boolean;
};

export type UsersTableMeta = {
  currentUserId: string;
  isSuperAdmin: boolean;
  canCreate: boolean;
};
