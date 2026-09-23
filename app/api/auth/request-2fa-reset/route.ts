import { requestTwoFactorResetForSession } from "@/lib/auth/two-factor-reset-request";

export async function POST() {
  const result = await requestTwoFactorResetForSession();
  return Response.json(result, { status: result.success ? 200 : 401 });
}
