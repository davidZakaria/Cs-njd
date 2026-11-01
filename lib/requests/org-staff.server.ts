import type { OrgStaffAvailability } from "@/lib/requests/approver-roles";
import { basePrisma } from "@/lib/prisma";

export type OrgStaffDb = Pick<typeof basePrisma, "user">;

const activeStaffWhere = {
  isActive: true,
  deletedAt: null,
} as const;

export async function getOrgStaffAvailability(
  prisma: OrgStaffDb = basePrisma
): Promise<OrgStaffAvailability> {
  const [legalCount, financeCount] = await Promise.all([
    prisma.user.count({ where: { role: "LEGAL", ...activeStaffWhere } }),
    prisma.user.count({ where: { role: "FINANCE", ...activeStaffWhere } }),
  ]);

  return {
    hasLegalStaff: legalCount > 0,
    hasFinanceStaff: financeCount > 0,
  };
}
