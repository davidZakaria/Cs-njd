export const SESSION_REVOKED_ERROR = "SessionRevoked";

/** Max JWT session lifetime in seconds (default: 8 hours). */
export const SESSION_MAX_AGE_SECONDS = Number(
  process.env.AUTH_SESSION_MAX_AGE_SECONDS ?? 8 * 60 * 60
);

/** Refresh the session cookie while the user is active (default: 30 minutes). */
export const SESSION_UPDATE_AGE_SECONDS = Number(
  process.env.AUTH_SESSION_UPDATE_AGE_SECONDS ?? 30 * 60
);

/**
 * When true, the session cookie is not persisted across browser restarts
 * (no Max-Age on the auth cookie; JWT exp still enforced via maxAge above).
 */
export const SESSION_BROWSER_ONLY =
  process.env.AUTH_SESSION_BROWSER_ONLY !== "false";

export function buildSessionCookieOptions(): {
  httpOnly: true;
  sameSite: "lax";
  path: string;
  secure: boolean;
  maxAge?: number;
} {
  const options = {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  };

  if (SESSION_BROWSER_ONLY) {
    return options;
  }

  return { ...options, maxAge: SESSION_MAX_AGE_SECONDS };
}
