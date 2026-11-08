import { describe, expect, it } from "vitest";

import {
  groupViolationItemsForPrint,
  interpolateHandoverText,
  joinViolationFragments,
  joinViolationPieces,
  splitViolationItems,
} from "@/lib/print/handover-templates/fields";

function violationItemsLikePrint(source: string): string[] {
  const grouped = groupViolationItemsForPrint(splitViolationItems(source));
  const tailIdx = grouped.findIndex((chunk) => chunk.includes("كل ما ورد من انواع المخالفات"));
  if (tailIdx > 0) {
    grouped[tailIdx - 1] = joinViolationFragments(grouped[tailIdx - 1]!, grouped[tailIdx]!);
    grouped.splice(tailIdx, 1);
  }
  return grouped;
}
import { loadHandoverTemplate } from "@/lib/print/handover-templates/resolve";
import type { HandoverFieldValues } from "@/lib/print/handover-templates/types";

const baseFields: HandoverFieldValues = {
  clientName: "Demo Owner",
  nationality: "مصري",
  nationalId: "29001010000001",
  address: "Sample Street",
  phone1: "+201000000001",
  phone2: "—",
  email: "owner@example.test",
  unitNumber: "701",
  floor: "3",
  building: "B",
  area: "145",
  areaInWords: "145",
  handoverDate: "17/05/2026",
  contractDay: "30",
  contractMonth: "September",
  contractYear: "2025",
  issuedDayName: "Sunday",
  issuedDate: "17/05/2026",
  contractShortDate: "30/09/2025",
};

describe("violation fragment join (word boundaries)", () => {
  it("inserts a space when fragments would otherwise fuse Arabic words", () => {
    expect(joinViolationFragments("عدم", "عمل أكثر")).toBe("عدم عمل أكثر");
    expect(joinViolationFragments("نموذجي .", "عمل تجليدات")).toBe("نموذجي .عمل تجليدات");
  });

  it("preserves source violation text when regrouping for print", () => {
    const keys = [
      "green-avenue",
      "green-avenue-no-insurance",
      "green-avenue-dual",
      "green-avenue-dual-no-insurance",
    ] as const;
    for (const key of keys) {
      const template = loadHandoverTemplate(key);
      expect(template.kind).toBe("green-avenue");
      const body = interpolateHandoverText(template.violationsBody, baseFields);
      const split = splitViolationItems(body);
      const splitCore = joinViolationPieces(split);
      const printed = violationItemsLikePrint(body);
      const printCore = joinViolationPieces(printed);

      expect(printCore).toBe(splitCore);
      expect(printCore).not.toMatch(/عدمعمل/u);
      expect(body).not.toMatch(/عدمعمل/u);
    }
  });
});
