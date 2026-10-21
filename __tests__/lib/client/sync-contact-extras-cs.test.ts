import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ContactSyncClient } from "@/lib/client/sync-contact-extras";

const mockTx = {
  clientPhone: {
    findMany: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  clientAddress: {
    findMany: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
};

describe("syncClientExtra — CS preserveOmittedPersisted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not delete omitted extra phones when preserveOmittedPersisted is true", async () => {
    mockTx.clientPhone.findMany.mockResolvedValue([
      { id: "phone-extra", phone: "0111", sortOrder: 0, clientId: "client-1" },
    ]);

    const { syncClientExtraPhones } = await import("@/lib/client/sync-contact-extras");

    await syncClientExtraPhones(
      mockTx as unknown as ContactSyncClient,
      "client-1",
      "0100",
      [],
      { preserveOmittedPersisted: true }
    );

    expect(mockTx.clientPhone.delete).not.toHaveBeenCalled();
  });

  it("still deletes omitted phones in default management mode", async () => {
    mockTx.clientPhone.findMany.mockResolvedValue([
      { id: "phone-extra", phone: "0111", sortOrder: 0, clientId: "client-1" },
    ]);

    const { syncClientExtraPhones } = await import("@/lib/client/sync-contact-extras");

    await syncClientExtraPhones(
      mockTx as unknown as ContactSyncClient,
      "client-1",
      "0100",
      []
    );

    expect(mockTx.clientPhone.delete).toHaveBeenCalledWith({
      where: { id: "phone-extra" },
    });
  });
});
