import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ContactSyncClient } from "@/lib/client/sync-contact-extras";

import {
  recordAuditRowIfContext,
  runWithAsyncAuditContext,
  type SimulatedAuditRow,
} from "../../helpers/async-audit-context";

const auditRows: SimulatedAuditRow[] = [];

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

describe("syncClientExtra contact removal under audit context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditRows.length = 0;

    mockTx.clientPhone.delete.mockImplementation(async () => {
      recordAuditRowIfContext("ClientPhone", "DELETE", auditRows);
    });
    mockTx.clientAddress.delete.mockImplementation(async () => {
      recordAuditRowIfContext("ClientAddress", "DELETE", auditRows);
    });
  });

  it("removing an extra phone issues a delete while audit context is active", async () => {
    mockTx.clientPhone.findMany.mockResolvedValue([
      { id: "phone-extra", phone: "0111", sortOrder: 0, clientId: "client-1" },
    ]);

    const { syncClientExtraPhones } = await import("@/lib/client/sync-contact-extras");

    await runWithAsyncAuditContext({ userId: "agent-1" }, async () => {
      await syncClientExtraPhones(
        mockTx as unknown as ContactSyncClient,
        "client-1",
        "0100",
        []
      );
    });

    expect(mockTx.clientPhone.delete).toHaveBeenCalledWith({
      where: { id: "phone-extra" },
    });
    expect(auditRows).toContainEqual({
      userId: "agent-1",
      tableName: "ClientPhone",
      action: "DELETE",
    });
  });

  it("removing an extra address issues a delete while audit context is active", async () => {
    mockTx.clientAddress.findMany.mockResolvedValue([
      {
        id: "address-extra",
        address: "Extra street",
        sortOrder: 0,
        clientId: "client-1",
      },
    ]);

    const { syncClientExtraAddresses } = await import(
      "@/lib/client/sync-contact-extras"
    );

    await runWithAsyncAuditContext({ userId: "agent-1" }, async () => {
      await syncClientExtraAddresses(
        mockTx as unknown as ContactSyncClient,
        "client-1",
        "Main street",
        []
      );
    });

    expect(mockTx.clientAddress.delete).toHaveBeenCalledWith({
      where: { id: "address-extra" },
    });
    expect(auditRows).toContainEqual({
      userId: "agent-1",
      tableName: "ClientAddress",
      action: "DELETE",
    });
  });
});
