import { describe, expect, it } from "vitest";
import { parseCsvText } from "../src/lib/csv/parser";

describe("CSV parsing", () => {
  it("parses BOM, quoted commas, multiline fields, and keeps original line numbers", () => {
    const parsed = parseCsvText('\uFEFFid,name\r\n\r\n1,"Ali, Khan"\r\n2,"line one\r\nline two"\r\n', "students.csv");
    expect(parsed.headers).toEqual(["id", "name"]);
    expect(parsed.rows[0].name).toBe("Ali, Khan");
    expect(parsed.rows[1].name).toBe("line one\r\nline two");
    expect(parsed.rowNumbers).toEqual([3, 4]);
  });

  it("rejects an empty CSV", () => {
    expect(() => parseCsvText("", "empty.csv")).toThrow(/empty/i);
  });

  it("rejects duplicate headers", () => {
    expect(() => parseCsvText("id,ID\n1,2", "dup.csv")).toThrow(/duplicate column headers/i);
  });

  it("rejects wrong column counts", () => {
    expect(() => parseCsvText("id,name\n1,Ali,Extra", "bad.csv")).toThrow(/columns; expected/i);
  });

  it("rejects broken quoting", () => {
    expect(() => parseCsvText('id,name\n1,"unclosed', "bad.csv")).toThrow(/parse error/i);
  });
});

import { readCsvFile, MAX_CSV_BYTES } from "../src/lib/csv/parser";

describe("file guards", () => {
  it("rejects unsupported file extensions", async () => {
    await expect(readCsvFile(new File(["id,name\n1,Ali"], "bad.txt"))).rejects.toThrow(/\.csv files/);
  });

  it("rejects files over the size limit", async () => {
    await expect(readCsvFile(new File([new Uint8Array(MAX_CSV_BYTES + 1)], "big.csv"))).rejects.toThrow(/1 MB/);
  });

  it("rejects invalid UTF-8", async () => {
    await expect(readCsvFile(new File([new Uint8Array([0xff, 0xfe])], "bad.csv"))).rejects.toThrow(/UTF-8/);
  });
});
