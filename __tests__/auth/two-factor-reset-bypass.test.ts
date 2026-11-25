import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  twoFactorResetRequest: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  loginHistory: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(async (fn: (tx: typeof mockPrisma) => Promise<void>) => {
    await fn(mockPrisma);
  }),
};

const mockAuditContext = {
  getStore: vi.fn(() => ({ userId: "user-1", ipAddress: "127.0.0.1" })),
};

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

const mockAuditLogCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
  basePrisma: {
    ...mockPrisma,
    auditLog: { create: (...args: unknown[]) => mockAuditLogCreate(...args) },
  },
}));

vi.mock("@/lib/prisma/audit-context", () => ({
  auditContext: mockAuditContext,
}));

vi.mock("next/headers", () => ({
  headers: () =>
    Promise.resolve({
      get: (name: string) =>
        name === "x-forwarded-for" ? "203.0.113.1" : null,
    }),
}));

vi.mock("@/lib/services/notifications", () => ({
  notifyRoles: vi.fn(),
  notifyUser: vi.fn(),
}));

const mockRateLimit = {
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true }),
  recordFailure: vi.fn(),
  userRateLimitKey: vi.fn((scope: string, id: string) => `${scope}:${id}`),
  authRateLimitKey: vi.fn((scope: string, ip: string) => `${scope}:${ip}`),
  AUTH_RATE_LIMIT_ERROR: "RATE_LIMITED",
};

vi.mock("@/lib/security/rate-limit", () => mockRateLimit);

const mockTwoFactor = {
  verifyTotp: vi.fn(),
  normalizeTotpSecret: (v: string) => v,
  buildOtpAuthUrl: vi.fn(),
  generateQrDataUrl: vi.fn().mockResolvedValue("data:image/png;base64,qr"),
  generateTwoFactorSecret: vi.fn().mockReturnValue({ secret: "NEWSECRET" }),
};

vi.mock("@/lib/two-factor", () => mockTwoFactor);

describe("2FA reset approval bypass regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.twoFactorResetRequest.findFirst.mockReset();
    mockPrisma.user.findUnique.mockReset();
    mockRateLimit.checkRateLimit.mockReturnValue({ allowed: true });
    mockAuth.mockResolvedValue({
      user: { id: "agent-1", email: "agent@fake.test", role: "CS_AGENT" },
    });
  });

  it("does not report enrollment for stale approval when 2FA is still enabled", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      is2FAEnabled: true,
      twoFactorSecret: "secret",
    });
    mockPrisma.twoFactorResetRequest.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        status: "APPROVED",
        reviewedAt: new Date("2020-01-01"),
        usedAt: null,
      });

    const { getTwoFactorResetStatusForSession } = await import(
      "@/lib/auth/two-factor-reset-request"
    );
    const result = await getTwoFactorResetStatusForSession();

    expect(result.needsEnrollment).toBe(false);
    expect(result.status).toBe("none");
  });

  it("refuses setup QR generation when 2FA remains enabled", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      is2FAEnabled: true,
      twoFactorSecret: "secret",
    });

    const { getSetupTwoFactorData } = await import("@/lib/auth/setup-two-factor");
    const result = await getSetupTwoFactorData();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("SETUP_NOT_ALLOWED");
    }
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("happy path: approve clears 2FA, enroll consumes request", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      email: "agent@fake.test",
      is2FAEnabled: false,
      twoFactorSecret: "NEWSECRET",
    });

    mockPrisma.twoFactorResetRequest.findFirst.mockResolvedValueOnce({
      id: "req-1",
      status: "PENDING",
      user: { id: "agent-1", name: "Agent", email: "agent@fake.test" },
    });

    mockAuth.mockResolvedValue({
      user: { id: "admin-1", role: "SUPER_ADMIN" },
    });

    const { approveTwoFactorResetRequest } = await import(
      "@/lib/auth/two-factor-reset-request"
    );
    const approved = await approveTwoFactorResetRequest("agent-1");
    expect(approved.success).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "agent-1" },
      data: { is2FAEnabled: false, twoFactorSecret: null },
    });

    mockAuth.mockResolvedValue({
      user: { id: "agent-1", email: "agent@fake.test" },
    });
    mockTwoFactor.verifyTotp.mockReturnValue(true);

    const { confirmSetupTwoFactor } = await import("@/lib/auth/setup-two-factor");
    const enrolled = await confirmSetupTwoFactor("NEWSECRET", "123456");
    expect(enrolled.success).toBe(true);
    expect(mockPrisma.twoFactorResetRequest.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "agent-1",
        status: "APPROVED",
        usedAt: null,
      },
      data: { usedAt: expect.any(Date) },
    });
  });

  it("rate-limits reset requests per user", async () => {
    mockRateLimit.checkRateLimit.mockReturnValue({ allowed: false });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "agent-1",
      name: "Agent",
      email: "agent@fake.test",
      is2FAEnabled: true,
      twoFactorSecret: "secret",
    });

    const { requestTwoFactorResetForSession } = await import(
      "@/lib/auth/two-factor-reset-request"
    );
    const result = await requestTwoFactorResetForSession();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("RATE_LIMITED");
    }
    expect(mockPrisma.twoFactorResetRequest.create).not.toHaveBeenCalled();
  });

  it("surfaces rejected reset status for 24h", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      is2FAEnabled: true,
      twoFactorSecret: "secret",
    });
    mockPrisma.twoFactorResetRequest.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        status: "REJECTED",
        reviewedAt: new Date(),
        usedAt: null,
      });

    const { getTwoFactorResetStatusForSession } = await import(
      "@/lib/auth/two-factor-reset-request"
    );
    const result = await getTwoFactorResetStatusForSession();

    expect(result.status).toBe("rejected");
    expect(result.needsEnrollment).toBe(false);
  });
});

describe("isTwoFactorVerifiedForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when TWO_FACTOR_SUCCESS is newer than PASSWORD_OK", async () => {
    mockPrisma.loginHistory.findFirst
      .mockResolvedValueOnce({ timestamp: new Date("2026-01-01T10:00:00Z") })
      .mockResolvedValueOnce({ timestamp: new Date("2026-01-01T10:05:00Z") });

    const { isTwoFactorVerifiedForUser } = await import(
      "@/lib/auth/two-factor-verified"
    );
    await expect(isTwoFactorVerifiedForUser("user-1")).resolves.toBe(true);
  });
});