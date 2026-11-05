import { describe, expect, it } from "vitest";

import {
  HANDOVER_BORDER_INNER_INSET_MM,
  HANDOVER_BORDER_OUTER_INSET_MM,
  HANDOVER_PAGE_MARGIN_MM,
  HANDOVER_PRINT_CSS,
} from "@/lib/official-documents/handover/html/styles";

describe("handover print layout constants", () => {
  it("keeps content margin inside the fixed border inset", () => {
    expect(HANDOVER_PAGE_MARGIN_MM).toBeGreaterThanOrEqual(
      HANDOVER_BORDER_INNER_INSET_MM + 5
    );
    expect(HANDOVER_BORDER_OUTER_INSET_MM).toBe(8);
    expect(HANDOVER_PAGE_MARGIN_MM).toBe(16);
  });

  it("embeds @page border inset, doc padding, and fixed frame offsets in CSS", () => {
    expect(HANDOVER_PRINT_CSS).toContain("margin: 8mm");
    expect(HANDOVER_PRINT_CSS).toContain("padding: 8mm");
    expect(HANDOVER_PRINT_CSS).toContain("box-decoration-break: clone");
    expect(HANDOVER_PRINT_CSS).toMatch(/\.print-frame-outer[\s\S]*top: 0/);
    expect(HANDOVER_PRINT_CSS).toContain("top: 1.5mm");
  });
});
