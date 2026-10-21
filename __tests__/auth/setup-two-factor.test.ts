import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
const mockPrismaUser = {
  findUnique: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: mockPrismaUser,
  },
}));

const mockVerifyTotp = vi.fn();
vi.mock("@/lib/two-factor", () => ({
  verifyTotp: (...args: unknown[]) => mockVerifyTotp(...args),
  normalizeTotpSecret: (value: string) => value.replace(/\s+/g, ""),
  buildOtpAuthUrl: vi.fn(),
  generateQrDataUrl: vi.fn(),
  generateTwoFactorSecret: vi.fn(),
}));

describe("confirmSetupTwoFactor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: "user-1", email: "user@test.com" },
    });
  });

  it("returns SETUP_SECRET_CHANGED when submitted secret no longer matches the database", async () => {
    mockPrismaUser.findUnique.mockResolvedValue({
      twoFactorSecret: "NEWSECRET",
      is2FAEnabled: false,
    });

    const { confirmSetupTwoFactor } = await import("@/lib/auth/setup-two-factor");
    const result = await confirmSetupTwoFactor("OLDSECRET", "123456");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("SETUP_SECRET_CHANGED");
    }
    expect(mockVerifyTotp).not.toHaveBeenCalled();
  });
});
