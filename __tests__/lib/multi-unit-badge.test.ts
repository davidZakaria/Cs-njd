import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  clientsRepresentSameOwner,
  collectQualityPhones,
  isFullOwnerName,
  isPhonePlaceholder,
  isValidNationalIdForMatch,
  normalizeQualityPhone,
  getMultiUnitBadgeData,
  type ClientIdentityFields,
} from "@/lib/units/multi-unit-badge";

vi.mock("@/lib/prisma", () => ({
  activeUnitWhere: (where: object) => ({ deletedAt: null, ...where }),
  prisma: {
    client: {
      findUnique: vi.fn(),
    },
    unit: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const client = (overrides: Partial<ClientIdentityFields> & { id: string }): ClientIdentityFields => ({
  name: "Ahmed Hassan",
  phone1: null,
  phone2: null,
  nationalId: null,
  phones: [],
  ...overrides,
});

describe("multi-unit owner matching", () => {
  describe("placeholders", () => {
    it("ignores placeholder phones", () => {
      expect(isPhonePlaceholder("؟؟")).toBe(true);
      expect(isPhonePlaceholder("-")).toBe(true);
      expect(isPhonePlaceholder("N/A")).toBe(true);
      expect(isPhonePlaceholder("123")).toBe(true);
      expect(normalizeQualityPhone("؟؟")).toBeNull();
    });

    it("ignores invalid national IDs", () => {
      expect(isValidNationalIdForMatch("")).toBeNull();
      expect(isValidNationalIdForMatch("???")).toBeNull();
      expect(isValidNationalIdForMatch("12345")).toBeNull();
      expect(isValidNationalIdForMatch("28501234567890")).toBe("28501234567890");
    });
  });

  describe("clientsRepresentSameOwner", () => {
    it("matches same clientId", () => {
      const a = client({ id: "c1", nationalId: "28501234567890" });
      const b = client({ id: "c1", nationalId: "29999999999999" });
      expect(clientsRepresentSameOwner(a, b)).toBe(true);
    });

    it("matches same valid national ID", () => {
      const a = client({ id: "c1", nationalId: "285-0123-4567-890" });
      const b = client({ id: "c2", nationalId: "28501234567890" });
      expect(clientsRepresentSameOwner(a, b)).toBe(true);
    });

    it("rejects shared phone when national IDs differ", () => {
      const sharedPhone = "01012345678";
      const a = client({
        id: "c1",
        name: "Mohamed Ali",
        phone1: sharedPhone,
        nationalId: "28501234567890",
      });
      const b = client({
        id: "c2",
        name: "Mohamed Ali",
        phone1: "+20 10 1234 5678",
        nationalId: "29912345678901",
      });
      expect(clientsRepresentSameOwner(a, b)).toBe(false);
    });

    it("matches formatted phone + full name when NID is missing", () => {
      const a = client({
        id: "c1",
        name: "Sara Mahmoud",
        phone1: "01098765432",
      });
      const b = client({
        id: "c2",
        name: "Sara  Mahmoud",
        phone1: "+20 10 9876 5432",
      });
      expect(clientsRepresentSameOwner(a, b)).toBe(true);
    });

    it("rejects phone match with different names", () => {
      const a = client({
        id: "c1",
        name: "Omar Ibrahim",
        phone1: "01055556666",
      });
      const b = client({
        id: "c2",
        name: "Hassan Khalil",
        phone1: "01055556666",
      });
      expect(clientsRepresentSameOwner(a, b)).toBe(false);
    });

    it("rejects phone match on single-token names", () => {
      expect(isFullOwnerName("Broker")).toBe(false);
      const a = client({ id: "c1", name: "Broker", phone1: "01011112222" });
      const b = client({ id: "c2", name: "Broker", phone1: "01011112222" });
      expect(clientsRepresentSameOwner(a, b)).toBe(false);
    });

    it("normalizes Egyptian phone formats", () => {
      const phones = collectQualityPhones(
        client({ id: "x", phone1: "+20 10 1234 5678" })
      );
      expect(phones).toEqual(["1012345678"]);
    });
  });

  describe("getMultiUnitBadgeData", () => {
    beforeEach(() => {
      vi.mocked(prisma.client.findUnique).mockReset();
      vi.mocked(prisma.unit.findMany).mockReset();
    });

    it("returns null when no other units match", async () => {
      vi.mocked(prisma.client.findUnique).mockResolvedValue({
        id: "ref",
        name: "Ahmed Hassan",
        phone1: "01000000001",
        phone2: null,
        nationalId: "28501234567890",
        phones: [],
      } as never);
      vi.mocked(prisma.unit.findMany).mockResolvedValue([] as never);

      const result = await getMultiUnitBadgeData("ref", "unit-current", {
        unitCode: "A-1",
        projectName: "Green",
      });
      expect(result).toBeNull();
    });

    it("includes current unit in tooltip list with matching count", async () => {
      const reference = {
        id: "ref",
        name: "Ahmed Hassan",
        phone1: "01000000001",
        phone2: null,
        nationalId: "28501234567890",
        phones: [],
      };
      vi.mocked(prisma.client.findUnique).mockResolvedValue(reference as never);
      vi.mocked(prisma.unit.findMany).mockResolvedValue([
        {
          id: "unit-b",
          unitCode: "A-2",
          project: { name: "Green" },
          client: reference,
          unitClients: [],
        },
      ] as never);

      const result = await getMultiUnitBadgeData("ref", "unit-current", {
        unitCode: "A-1",
        projectName: "Green",
      });

      expect(result?.unitCount).toBe(2);
      expect(result?.units).toHaveLength(2);
      expect(result?.units.some((u) => u.isCurrent && u.unitCode === "A-1")).toBe(
        true
      );
      expect(result?.units.some((u) => !u.isCurrent && u.unitCode === "A-2")).toBe(
        true
      );
    });

    it("per-owner badges: primary with two units, co-owner with none", async () => {
      const primaryRef = {
        id: "primary",
        name: "Ahmed Hassan",
        phone1: null,
        phone2: null,
        nationalId: "28501234567890",
        phones: [],
      };
      const coOwnerRef = {
        id: "co",
        name: "Sara Mahmoud",
        phone1: null,
        phone2: null,
        nationalId: "29912345678901",
        phones: [],
      };

      vi.mocked(prisma.client.findUnique).mockResolvedValueOnce(primaryRef as never);
      vi.mocked(prisma.unit.findMany).mockResolvedValueOnce([
        {
          id: "unit-b",
          unitCode: "A-2",
          project: { name: "Green" },
          client: primaryRef,
          unitClients: [],
        },
      ] as never);

      const primaryBadge = await getMultiUnitBadgeData("primary", "unit-a", {
        unitCode: "A-1",
        projectName: "Green",
      });

      vi.mocked(prisma.client.findUnique).mockResolvedValueOnce(coOwnerRef as never);
      vi.mocked(prisma.unit.findMany).mockResolvedValueOnce([] as never);

      const coBadge = await getMultiUnitBadgeData("co", "unit-a", {
        unitCode: "A-1",
        projectName: "Green",
      });

      expect(primaryBadge?.unitCount).toBe(2);
      expect(coBadge).toBeNull();
    });

    it("filters out units whose owners only share a broker phone", async () => {
      const reference = {
        id: "ref",
        name: "Youssef Nabil",
        phone1: "01012345678",
        phone2: null,
        nationalId: "28501234567890",
        phones: [],
      };
      const unrelated = {
        id: "other",
        name: "Karim Said",
        phone1: "01012345678",
        phone2: null,
        nationalId: "29912345678901",
        phones: [],
      };
      vi.mocked(prisma.client.findUnique).mockResolvedValue(reference as never);
      vi.mocked(prisma.unit.findMany).mockResolvedValue([
        {
          id: "unit-b",
          unitCode: "B-9",
          project: { name: "Jamila" },
          client: unrelated,
          unitClients: [],
        },
      ] as never);

      const result = await getMultiUnitBadgeData("ref", "unit-current", {
        unitCode: "A-1",
        projectName: "Green",
      });
      expect(result).toBeNull();
    });
  });
});