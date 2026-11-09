import { describe, expect, it } from "vitest";

import {
  assertHandoverPdfSliceNoFusion,
  assertHandoverViolationWordBoundaries,
  handoverTextHasFusedAdmAmal,
} from "@/lib/official-documents/handover/violation-word-boundary";

describe("handover violation word boundary guards", () => {
  it("detects fused عدمعمل", () => {
    expect(handoverTextHasFusedAdmAmal("به .عدمعمل أكثر من مدخل")).toBe(true);
    expect(handoverTextHasFusedAdmAmal("عدم عمل حمام")).toBe(false);
  });

  it("pdf slice guard rejects fusion without requiring full phrase on one page", () => {
    expect(() => assertHandoverPdfSliceNoFusion("عدم تركيب أجهزة", "p2")).not.toThrow();
    expect(() => assertHandoverPdfSliceNoFusion("عدمعمل", "p2")).toThrow(/fused/i);
  });

  it("assert requires spaced عدم عمل and rejects fusion", () => {
    expect(() =>
      assertHandoverViolationWordBoundaries("عدم عمل أكثر", "t")
    ).not.toThrow();
    expect(() =>
      assertHandoverViolationWordBoundaries("عدمعمل حمام", "t")
    ).toThrow(/fused/i);
  });
});
