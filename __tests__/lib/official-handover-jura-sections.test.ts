import { describe, expect, it } from "vitest";

import { splitJuraSectionHeadingBody } from "@/lib/official-documents/handover/html/jura-sections";

describe("splitJuraSectionHeadingBody", () => {
  it("keeps خامسا title separate from numbered body", () => {
    const text =
      "خامسا : تنظيم دخول الزوار والحيوانات الأليفة1. دخول الزوار:أتعهد بإخطار";
    const { heading, body } = splitJuraSectionHeadingBody(text);
    expect(heading).toBe("خامسا : تنظيم دخول الزوار والحيوانات الأليفة");
    expect(body.startsWith("1.")).toBe(true);
    expect(heading).not.toContain("أتعهد");
  });

  it("keeps عاشرا title separate from full body", () => {
    const text =
      "عاشراً: الإخلاء الإداري وإنهاء الإقامةيحق لشركة الإدارة إنهاء إقامة.هذا المحضر";
    const { heading, body } = splitJuraSectionHeadingBody(text);
    expect(heading).toBe("عاشراً: الإخلاء الإداري وإنهاء الإقامة");
    expect(body.startsWith("يحق")).toBe(true);
    expect(body).toContain("هذا المحضر");
  });
});
