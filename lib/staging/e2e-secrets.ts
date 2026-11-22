/**
 * Staging test credentials — read from env on public staging; defaults only for CI/local.
 */

function allowDefaultSecrets(): boolean {
  return (
    process.env.CI === "true" ||
    process.env.STAGING_E2E_USE_DEFAULT_SECRETS === "true" ||
    process.env.NODE_ENV === "test"
  );
}

const DEFAULT_PASSWORD = "StagingTest12!";
const DEFAULT_TOTP = "JBSWY3DPEHPK3PXP";

export function resolveStagingPassword(): string {
  const fromEnv =
    process.env.STAGING_E2E_PASSWORD?.trim() ||
    process.env.STAGING_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  if (allowDefaultSecrets()) return DEFAULT_PASSWORD;
  throw new Error(
    "Set STAGING_E2E_PASSWORD (or STAGING_PASSWORD) before running staging seed or E2E."
  );
}

export function resolveStagingTotpSecret(): string {
  const fromEnv =
    process.env.STAGING_TOTP_SECRET?.trim() ||
    process.env.STAGING_E2E_TOTP_SECRET?.trim();
  if (fromEnv) return fromEnv;
  if (allowDefaultSecrets()) return DEFAULT_TOTP;
  throw new Error(
    "Set STAGING_TOTP_SECRET before running staging seed or E2E against a public staging host."
  );
}