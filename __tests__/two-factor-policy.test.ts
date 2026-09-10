import { describe, it, expect } from "vitest";
import {
  isTwoFactorRequired,
  engineerSessionFlags,
} from "@/lib/auth/two-factor-policy";

describe("Two-Factor Policy", () => {
  describe("isTwoFactorRequired", () => {
    it("requires 2FA for SUPER_ADMIN", () => {
      expect(isTwoFactorRequired("SUPER_ADMIN")).toBe(true);
    });

    it("requires 2FA for MANAGEMENT", () => {
      expect(isTwoFactorRequired("MANAGEMENT")).toBe(true);
    });

    it("requires 2FA for CS_AGENT", () => {
      expect(isTwoFactorRequired("CS_AGENT")).toBe(true);
    });

    it("does NOT require 2FA for ENGINEER", () => {
      expect(isTwoFactorRequired("ENGINEER")).toBe(false);
    });
  });

  describe("engineerSessionFlags", () => {
    it("returns null for non-engineer roles", () => {
      expect(engineerSessionFlags("SUPER_ADMIN")).toBeNull();
      expect(engineerSessionFlags("MANAGEMENT")).toBeNull();
      expect(engineerSessionFlags("CS_AGENT")).toBeNull();
    });

    it("returns bypass flags for ENGINEER", () => {
      const flags = engineerSessionFlags("ENGINEER");
      expect(flags).not.toBeNull();
      expect(flags!.is2FAEnabled).toBe(false);
      expect(flags!.needs2FASetup).toBe(false);
      expect(flags!.twoFactorVerified).toBe(true);
    });
  });
});
