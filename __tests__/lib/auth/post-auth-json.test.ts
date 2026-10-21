import { afterEach, describe, expect, it, vi } from "vitest";

import {
  postAuthJson,
  PostAuthRequestError,
  readJsonResponse,
} from "@/lib/auth/post-auth-json";

describe("post-auth-json", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed ActionResult on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      )
    );

    const result = await postAuthJson("/api/auth/verify-2fa", { token: "123456" });
    expect(result.success).toBe(true);
  });

  it("returns structured failure without throwing for 401 JSON bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: false, error: "INVALID_CODE" }), {
          status: 401,
        })
      )
    );

    const result = await postAuthJson("/api/auth/verify-2fa", { token: "000000" });
    expect(result).toEqual({ success: false, error: "INVALID_CODE" });
  });

  it("throws with server error text when response is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("upstream error", { status: 502 }))
    );

    await expect(postAuthJson("/api/auth/verify-2fa", { token: "123456" })).rejects.toThrow(
      PostAuthRequestError
    );
  });

  it("readJsonResponse rejects empty bodies", async () => {
    await expect(
      readJsonResponse(new Response("", { status: 500 }))
    ).rejects.toThrow("Empty response");
  });
});
