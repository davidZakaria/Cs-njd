import { getTwoFactorResetStatusForSession } from "@/lib/auth/two-factor-reset-request";

export async function GET() {
  const result = await getTwoFactorResetStatusForSession();
  return Response.json(result);
}
