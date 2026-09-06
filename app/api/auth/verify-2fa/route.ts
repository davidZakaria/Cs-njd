import { verifyTwoFactorCode } from "@/lib/auth/two-factor-session";
import { getIpFromRequest } from "@/lib/auth/request-meta";
import {
  AUTH_RATE_LIMIT_ERROR,
  authRateLimitKey,
  checkRateLimit,
} from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const ipAddress = getIpFromRequest(request);
  const rateLimitKey = authRateLimitKey("2fa", ipAddress);
  const rateCheck = checkRateLimit(rateLimitKey);
  if (!rateCheck.allowed) {
    return Response.json(
      { success: false, error: AUTH_RATE_LIMIT_ERROR },
      { status: 429 }
    );
  }

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
  if (!result.success && result.error === AUTH_RATE_LIMIT_ERROR) {
    return Response.json(result, { status: 429 });
  }

  return Response.json(result, { status: result.success ? 200 : 401 });
}
