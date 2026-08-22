export function getIpFromRequest(request?: Request | null): string | undefined {
  if (!request) return undefined;
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || undefined;
  }
  return request.headers.get("x-real-ip") ?? undefined;
}

export function getUserAgentFromRequest(request?: Request | null): string | undefined {
  return request?.headers.get("user-agent") ?? undefined;
}
