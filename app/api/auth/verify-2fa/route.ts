import { verifyTwoFactorCode } from "@/lib/auth/two-factor-session";

export async function POST(request: Request) {
  let token = "";

  try {
    const body = (await request.json()) as { token?: string };
    token = String(body.token ?? "");
  } catch {
    return Response.json(
      { success: false, error: "CODE_REQUIRED" },
      { status: 400 }
    );
  }

  const result = await verifyTwoFactorCode(token);
  return Response.json(result, { status: result.success ? 200 : 401 });
}
