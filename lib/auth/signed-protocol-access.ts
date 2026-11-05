import {
  canAccessUnitAsCsAgent,
  resolveCsAgentScope,
  type CsAgentScope,
} from "@/lib/auth/cs-agent-scope";
import {
  isAdminUnitManager,
  isCsAgentRole,
  isDepartmentStaffRole,
  isOperationsRole,
} from "@/lib/auth/unit-roles";
import type { Role } from "@prisma/client";

type SessionUser = {
  id: string;
  role: Role;
  email?: string | null;
};

export async function resolveSignedProtocolAccess(
  user: SessionUser,
  unitAgentId: string | null | undefined
): Promise<{ canUpload: boolean; csScope: CsAgentScope | null }> {
  if (isAdminUnitManager(user.role) || user.role === "SUPER_ADMIN") {
    return { canUpload: true, csScope: null };
  }

  if (isOperationsRole(user.role)) {
    return { canUpload: true, csScope: null };
  }

  if (user.role === "CS_AGENT") {
    const csScope = await resolveCsAgentScope(user);
    return {
      canUpload: canAccessUnitAsCsAgent(csScope, unitAgentId),
      csScope,
    };
  }

  return { canUpload: false, csScope: null };
}

/** Download/view unit portfolio files (contracts, annexes, etc.). Upload rules stay separate. */
export function canDownloadSignedProtocol(
  user: SessionUser,
  _unitAgentId: string | null | undefined,
  _csScope: CsAgentScope | null
): boolean {
  if (isAdminUnitManager(user.role) || user.role === "SUPER_ADMIN") {
    return true;
  }
  if (isOperationsRole(user.role)) {
    return true;
  }
  if (isDepartmentStaffRole(user.role)) {
    return true;
  }
  if (isCsAgentRole(user.role)) {
    return true;
  }
  return false;
}
