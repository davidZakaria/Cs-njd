export function parseBrowserLabel(userAgent: string | null | undefined): string {
  if (!userAgent?.trim()) return "—";

  const ua = userAgent;
  if (ua.includes("Edg/")) return "Microsoft Edge";
  if (ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Safari/") && !ua.includes("Chrome")) return "Safari";
  if (ua.includes("Opera") || ua.includes("OPR/")) return "Opera";

  return ua.length > 48 ? `${ua.slice(0, 48)}…` : ua;
}
