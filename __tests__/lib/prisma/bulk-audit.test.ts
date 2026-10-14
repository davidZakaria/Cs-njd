import { describe, expect, it, vi } from "vitest";

import {
  recordDeleteManyAudits,
  recordUpdateManyAudits,
} from "@/lib/prisma/bulk-audit";

describe("bulk audit helpers", () => {
  it("writes one DELETE audit row per record removed by deleteMany", async () => {
    const create = vi.fn().mockResolvedValue({});
    const delegate = {
      findMany: vi.fn().mockResolvedValue([
        { id: "phone-1", phone: "0111" },
        { id: "phone-2", phone: "0222" },
      ]),
    };

    await recordDeleteManyAudits(delegate, { auditLog: { create } } as never, {
      userId: "user-1",
      ipAddress: "127.0.0.1",
    }, "ClientPhone", { clientId: "client-1" });

    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        action: "DELETE",
        tableName: "ClientPhone",
        recordId: "phone-1",
        oldData: { id: "phone-1", phone: "0111" },
        ipAddress: "127.0.0.1",
      }),
    });
  });

  it("writes one UPDATE audit row per record touched by updateMany", async () => {
    const create = vi.fn().mockResolvedValue({});
    const delegate = {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "ticket-1", status: "RESOLVED" }]),
    };

    await recordUpdateManyAudits(
      delegate,
      { auditLog: { create } } as never,
      { userId: "user-1" },
      "Ticket",
      [{ id: "ticket-1", status: "PENDING" }]
    );

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        action: "UPDATE",
        tableName: "Ticket",
        recordId: "ticket-1",
        oldData: { id: "ticket-1", status: "PENDING" },
        newData: { id: "ticket-1", status: "RESOLVED" },
      }),
    });
  });
});
