import { getSetupTwoFactorData } from "@/lib/auth/setup-two-factor";

export async function GET() {
  const result = await getSetupTwoFactorData();
  return Response.json(result, { status: result.success ? 200 : 401 });
}
