import { describe, it, expect } from "vitest";
import {
  sanitizeOriginalFilename,
  isAllowedSignedProtocolMime,
  contentTypeForSignedProtocol,
  getSignedProtocolRelativePath,
  SIGNED_PROTOCOL_MIME_TYPES,
} from "@/lib/uploads/signed-protocol-storage";
import { MAX_UPLOAD_BYTES, NATIONAL_ID_MAX_BYTES } from "@/lib/uploads/limits";

describe("Upload Security", () => {
  describe("sanitizeOriginalFilename", () => {
    it("extracts basename from Unix paths (prevents traversal)", () => {
      expect(sanitizeOriginalFilename("../../../etc/passwd")).toBe("passwd");
      expect(sanitizeOriginalFilename("/path/to/file.pdf")).toBe("file.pdf");
    });

    it("sanitizes Windows-style paths", () => {
      const result = sanitizeOriginalFilename("C:\\Users\\file.pdf");
      expect(result).toContain("file.pdf");
    });

    it("replaces dangerous characters with underscore", () => {
      expect(sanitizeOriginalFilename("file<script>.pdf")).toBe(
        "file_script_.pdf"
      );
      expect(sanitizeOriginalFilename("file|name.pdf")).toBe("file_name.pdf");
      expect(sanitizeOriginalFilename("file;name.pdf")).toBe("file_name.pdf");
    });

    it("preserves safe characters", () => {
      expect(sanitizeOriginalFilename("file-name.pdf")).toBe("file-name.pdf");
      expect(sanitizeOriginalFilename("file_name.pdf")).toBe("file_name.pdf");
      expect(sanitizeOriginalFilename("file (1).pdf")).toBe("file (1).pdf");
      expect(sanitizeOriginalFilename("file+name.pdf")).toBe("file+name.pdf");
    });

    it("preserves Arabic characters", () => {
      expect(sanitizeOriginalFilename("محضر استلام.pdf")).toBe(
        "محضر استلام.pdf"
      );
    });

    it("truncates to 180 characters", () => {
      const longName = "a".repeat(200) + ".pdf";
      const result = sanitizeOriginalFilename(longName);
      expect(result.length).toBeLessThanOrEqual(180);
    });

    it("returns default for empty string input", () => {
      expect(sanitizeOriginalFilename("")).toBe("signed-protocol");
    });
  });

  describe("isAllowedSignedProtocolMime", () => {
    it("allows PDF", () => {
      expect(isAllowedSignedProtocolMime("application/pdf")).toBe(true);
    });

    it("allows JPEG", () => {
      expect(isAllowedSignedProtocolMime("image/jpeg")).toBe(true);
    });

    it("allows PNG", () => {
      expect(isAllowedSignedProtocolMime("image/png")).toBe(true);
    });

    it("allows WebP", () => {
      expect(isAllowedSignedProtocolMime("image/webp")).toBe(true);
    });

    it("rejects HTML", () => {
      expect(isAllowedSignedProtocolMime("text/html")).toBe(false);
    });

    it("rejects JavaScript", () => {
      expect(isAllowedSignedProtocolMime("application/javascript")).toBe(false);
      expect(isAllowedSignedProtocolMime("text/javascript")).toBe(false);
    });

    it("rejects executable types", () => {
      expect(isAllowedSignedProtocolMime("application/x-executable")).toBe(
        false
      );
      expect(isAllowedSignedProtocolMime("application/x-msdownload")).toBe(
        false
      );
    });

    it("rejects SVG (potential XSS vector)", () => {
      expect(isAllowedSignedProtocolMime("image/svg+xml")).toBe(false);
    });

    it("rejects arbitrary types", () => {
      expect(isAllowedSignedProtocolMime("application/octet-stream")).toBe(
        false
      );
      expect(isAllowedSignedProtocolMime("text/plain")).toBe(false);
    });
  });

  describe("contentTypeForSignedProtocol", () => {
    it("returns allowed MIME types as-is", () => {
      expect(contentTypeForSignedProtocol("application/pdf")).toBe(
        "application/pdf"
      );
      expect(contentTypeForSignedProtocol("image/jpeg")).toBe("image/jpeg");
    });

    it("returns octet-stream for disallowed types", () => {
      expect(contentTypeForSignedProtocol("text/html")).toBe(
        "application/octet-stream"
      );
      expect(contentTypeForSignedProtocol("application/javascript")).toBe(
        "application/octet-stream"
      );
    });

    it("returns octet-stream for null/undefined", () => {
      expect(contentTypeForSignedProtocol(null)).toBe(
        "application/octet-stream"
      );
      expect(contentTypeForSignedProtocol(undefined)).toBe(
        "application/octet-stream"
      );
    });
  });

  describe("getSignedProtocolRelativePath", () => {
    it("builds correct relative path", () => {
      expect(getSignedProtocolRelativePath("unit123", "file.pdf")).toBe(
        "signed-protocols/unit123/file.pdf"
      );
    });

    it("uses forward slashes (POSIX)", () => {
      const result = getSignedProtocolRelativePath("unit123", "file.pdf");
      expect(result).not.toContain("\\");
    });
  });

  describe("SIGNED_PROTOCOL_MIME_TYPES", () => {
    it("contains expected types", () => {
      expect(SIGNED_PROTOCOL_MIME_TYPES).toContain("application/pdf");
      expect(SIGNED_PROTOCOL_MIME_TYPES).toContain("image/jpeg");
      expect(SIGNED_PROTOCOL_MIME_TYPES).toContain("image/png");
      expect(SIGNED_PROTOCOL_MIME_TYPES).toContain("image/webp");
    });

    it("has exactly 4 allowed types", () => {
      expect(SIGNED_PROTOCOL_MIME_TYPES).toHaveLength(4);
    });
  });

  describe("upload limits", () => {
    it("MAX_UPLOAD_BYTES is 15MB", () => {
      expect(MAX_UPLOAD_BYTES).toBe(15 * 1024 * 1024);
    });

    it("NATIONAL_ID_MAX_BYTES is 10MB", () => {
      expect(NATIONAL_ID_MAX_BYTES).toBe(10 * 1024 * 1024);
    });
  });
});
