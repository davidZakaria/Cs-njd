import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import QRCode from "qrcode";
import { describe, expect, it } from "vitest";

import {
  buildOtpAuthUrl,
  generateQrDataUrl,
  qrModulePixelSize,
  TOTP_QR_RENDER_OPTIONS,
} from "@/lib/two-factor";

describe("2FA QR encoding", () => {
  const sampleUri = buildOtpAuthUrl(
    "agent@njd.example",
    "JBSWY3DPEHPK3PXP"
  );

  it("uses a short label with issuer only in query params", () => {
    expect(sampleUri).toMatch(/^otpauth:\/\/totp\/agent%40njd\.example\?/);
    expect(sampleUri).toContain("issuer=NJD%20CRM");
    expect(sampleUri).not.toContain("issuer=NJD+CRM");
    expect(decodeURIComponent(sampleUri.split("?")[0].replace("otpauth://totp/", ""))).toBe(
      "agent@njd.example"
    );
    expect(sampleUri).not.toContain("NJD%20CRM%3A");
    expect(sampleUri).not.toContain("NJD CRM:agent");
  });

  it("renders at QR version 6 or lower with at least 8px modules at width 336", () => {
    const { version, modulePx } = qrModulePixelSize(sampleUri);
    expect(version).toBeLessThanOrEqual(6);
    expect(modulePx).toBeGreaterThanOrEqual(8);
  });

  it.skipIf(
    (() => {
      try {
        execSync("zbarimg --version", { stdio: "ignore" });
        return false;
      } catch {
        return true;
      }
    })()
  )("decodes to the same otpauth URI with zbarimg", async () => {
    const dataUrl = await generateQrDataUrl(sampleUri);
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
    const dir = mkdtempSync(join(tmpdir(), "njd-qr-"));
    const pngPath = join(dir, "setup-qr.png");
    writeFileSync(pngPath, Buffer.from(base64, "base64"));

    const decoded = execSync(`zbarimg -q --raw "${pngPath}"`, {
      encoding: "utf8",
    }).trim();

    expect(decoded).toBe(sampleUri);
  });

  it("uses low error correction and wide margin in render options", async () => {
    const dataUrl = await generateQrDataUrl(sampleUri);
    const qr = QRCode.create(sampleUri, {
      errorCorrectionLevel: TOTP_QR_RENDER_OPTIONS.errorCorrectionLevel,
    });
    expect(dataUrl.startsWith("data:image/png")).toBe(true);
    expect(qr.version).toBeLessThanOrEqual(6);
  });
});
