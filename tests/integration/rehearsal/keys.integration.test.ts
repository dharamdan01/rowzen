import { describe, expect, it } from "vitest";
import { parseCsvText } from "../../../src/lib/csv/parser";
import { validateKeyConstraints } from "../../../src/lib/rehearsal/keys";

describe("Phase 6 key preflight + real CSV parser", () => {
  it("preserves original line numbers when CSV contains blank lines", () => {
    const regions = parseCsvText(
      "country,code\n\nPK,SE\nPK,CS\nPK,SE\n",
      "regions.csv",
    );
    const issues = validateKeyConstraints([regions], {
      regions: { primaryKey: ["country", "code"] },
    });
    expect(issues.map((i) => i.rowNumber)).toEqual([3, 5]);
    expect(issues.every((i) => i.code === "DUPLICATE_PK")).toBe(true);
  });

  it("treats quoted commas as one value and detects repeated UNIQUE values", () => {
    const people = parseCsvText(
      'id,name\n1,"Ali, Khan"\n2,"Ali, Khan"\n',
      "people.csv",
    );
    const issues = validateKeyConstraints([people], {
      people: { uniqueKeys: [["name"]] },
    });
    expect(issues.map((i) => i.rowNumber)).toEqual([2, 3]);
    expect(issues.every((i) => i.code === "DUPLICATE_UNIQUE")).toBe(true);
  });

  it("returns repeatable reports from identical parsed CSV and rules", () => {
    const parsed = parseCsvText("id,email\n1,a@b.test\n2,\n3,a@b.test\n", "users.csv");
    const configuration = { users: { primaryKey: ["id"], uniqueKeys: [["email"]] } };
    expect(validateKeyConstraints([parsed], configuration)).toEqual(
      validateKeyConstraints([parsed], configuration)
    );
  });
});
