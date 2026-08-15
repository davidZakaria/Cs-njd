import { authenticator } from "otplib";
import QRCode from "qrcode";

export function generateTwoFactorSecret(email: string) {
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(email, "NJD CRM", secret);
  return { secret, otpauth };
}

export async function generateQrDataUrl(otpauth: string) {
  return QRCode.toDataURL(otpauth);
}

export function verifyTotp(token: string, secret: string) {
  return authenticator.verify({ token, secret });
}
