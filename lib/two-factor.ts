import { authenticator } from "otplib";
import QRCode from "qrcode";

authenticator.options = {
  window: 5,
};

export const TOTP_ISSUER = "NJD CRM";

export const TOTP_QR_RENDER_OPTIONS = {
  errorCorrectionLevel: "L" as const,
  margin: 4,
  width: 336,
};

export function normalizeTotpSecret(secret: string): string {
  return secret.replace(/\s/g, "").toUpperCase();
}

export function buildOtpAuthUrl(email: string, secret: string) {
  const label = encodeURIComponent(email.trim());
  const normalizedSecret = normalizeTotpSecret(secret);
  const query = `secret=${encodeURIComponent(normalizedSecret)}&issuer=${encodeURIComponent(TOTP_ISSUER)}`;
  return `otpauth://totp/${label}?${query}`;
}

export function generateTwoFactorSecret(email: string) {
  const secret = authenticator.generateSecret();
  const otpauth = buildOtpAuthUrl(email, secret);
  return { secret, otpauth };
}

export async function generateQrDataUrl(otpauth: string) {
  return QRCode.toDataURL(otpauth, TOTP_QR_RENDER_OPTIONS);
}

export function qrModulePixelSize(
  otpauth: string,
  options: { width: number; margin: number; errorCorrectionLevel: "L" | "M" | "H" | "Q" } = TOTP_QR_RENDER_OPTIONS
): { version: number; modulePx: number; moduleCount: number } {
  const qr = QRCode.create(otpauth, {
    errorCorrectionLevel: options.errorCorrectionLevel,
  });
  const moduleCount = qr.modules.size;
  const modulePx = options.width / (moduleCount + options.margin * 2);
  return { version: qr.version, modulePx, moduleCount };
}

export function verifyTotp(token: string, secret: string) {
  const normalizedToken = token.replace(/\D/g, "").trim();
  if (normalizedToken.length !== 6) return false;

  return authenticator.check(
    normalizedToken,
    normalizeTotpSecret(secret)
  );
}
