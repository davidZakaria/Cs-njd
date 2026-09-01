import {
  canAccessUnitAsCsAgent,
  resolveCsAgentScope,
  type CsAgentScope,
} from "@/lib/auth/cs-agent-scope";
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
  if (user.role === "SUPER_ADMIN" || user.role === "MANAGEMENT") {
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

export function canDownloadSignedProtocol(
  user: SessionUser,
  unitAgentId: string | null | undefined,
  csScope: CsAgentScope | null
): boolean {
  if (user.role === "SUPER_ADMIN" || user.role === "MANAGEMENT") {
    return true;
  }
  if (user.role === "CS_AGENT" && csScope) {
    return canAccessUnitAsCsAgent(csScope, unitAgentId);
  }
  return false;
}
