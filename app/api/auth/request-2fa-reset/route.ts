import { withAudit } from "@/lib/audit/with-audit";
import { requestTwoFactorResetForSession } from "@/lib/auth/two-factor-reset-request";

export async function POST() {
  return withAudit(async () => {
    const result = await requestTwoFactorResetForSession();
    return Response.json(result, { status: result.success ? 200 : 401 });
  });
}
