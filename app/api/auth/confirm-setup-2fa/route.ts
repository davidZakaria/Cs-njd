import { confirmSetupTwoFactor } from "@/lib/auth/setup-two-factor";

export async function POST(request: Request) {
  let secret = "";
  let token = "";

  try {
    const body = (await request.json()) as { secret?: string; token?: string };
    secret = String(body.secret ?? "");
    token = String(body.token ?? "");
  } catch {
    return Response.json(
      { success: false, error: "INVALID_CODE" },
      { status: 400 }
    );
  }

  const result = await confirmSetupTwoFactor(secret, token);
  return Response.json(result, { status: result.success ? 200 : 401 });
}
