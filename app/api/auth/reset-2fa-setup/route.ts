import { resetTwoFactorSetupForSession } from "@/lib/auth/two-factor-session";

export async function POST() {
  const result = await resetTwoFactorSetupForSession();
  return Response.json(result, { status: result.success ? 200 : 401 });
}
