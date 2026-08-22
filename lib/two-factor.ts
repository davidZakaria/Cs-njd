import { authenticator } from "otplib";
import QRCode from "qrcode";

authenticator.options = {
  window: 5,
};

export function normalizeTotpSecret(secret: string): string {
  return secret.replace(/\s/g, "").toUpperCase();
}

export function generateTwoFactorSecret(email: string) {
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(email, "NJD CRM", secret);
  return { secret, otpauth };
}

export function buildOtpAuthUrl(email: string, secret: string) {
  return authenticator.keyuri(email, "NJD CRM", normalizeTotpSecret(secret));
}

export async function generateQrDataUrl(otpauth: string) {
  return QRCode.toDataURL(otpauth, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 220,
  });
}

export function verifyTotp(token: string, secret: string) {
  const normalizedToken = token.replace(/\D/g, "").trim();
  if (normalizedToken.length !== 6) return false;

  return authenticator.check(
    normalizedToken,
    normalizeTotpSecret(secret)
  );
}
