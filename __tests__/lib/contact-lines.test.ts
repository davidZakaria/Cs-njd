import { describe, expect, it } from "vitest";
import { listClientExtraPhones } from "@/lib/client/contact-lines";

describe("listClientExtraPhones", () => {
  it("includes migrated relation rows and legacy phone2", () => {
    const rows = listClientExtraPhones({
      phone1: "0100",
      phone2: "0111",
      address1: null,
      address2: null,
      phones: [{ id: "p1", phone: "0222", sortOrder: 0 }],
    });

    expect(rows.map((row) => row.phone)).toEqual(["0222", "0111"]);
  });

  it("skips legacy phone2 when it duplicates primary", () => {
    const rows = listClientExtraPhones({
      phone1: "0100",
      phone2: "0100",
      address1: null,
      address2: null,
      phones: [],
    });

    expect(rows).toEqual([]);
  });
});
