import { withAudit } from "@/lib/audit/with-audit";
import { getSetupTwoFactorData } from "@/lib/auth/setup-two-factor";

export async function GET() {
  return withAudit(async () => {
    const result = await getSetupTwoFactorData();
    const status = result.success
      ? 200
      : result.error === "SETUP_NOT_ALLOWED" || result.error === "APPROVAL_REQUIRED"
        ? 403
        : 401;
    return Response.json(result, { status });
  });
}
