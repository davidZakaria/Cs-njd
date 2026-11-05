import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

describe("next.config production assets", () => {
  it("keeps harfbuzzjs external with wasm tracing for PDF generation", () => {
    expect(nextConfig.serverExternalPackages).toContain("harfbuzzjs");
    const includes = nextConfig.outputFileTracingIncludes;
    expect(includes).toBeDefined();
    const wasmPaths = Object.values(includes ?? {}).flat();
    expect(wasmPaths.some((p) => p.includes("harfbuzzjs") && p.includes(".wasm"))).toBe(
      true
    );
  });
});
