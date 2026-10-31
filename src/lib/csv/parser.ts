// this file performs CSV parsing, header validation, row numbers, BOM handling operations

import Papa from "papaparse";
import type { Row } from "../rehearsal/engine";

export const MAX_CSV_BYTES = 1024 * 1024;

export type ParsedCsv = {
  name: string;
  filename: string;
  headers: string[];
  rows: Row[];
  rowNumbers: number[];
};

export function parseCsvText(text: string, filename: string): ParsedCsv {
  const input = text.replace(/^\uFEFF/, "");
  if (!input.trim()) throw new Error(`${filename}: CSV is empty`);
  if (input.includes("\u0000")) throw new Error(`${filename}: unsupported text encoding`);

  let headers: string[] = [];
  const rows: Row[] = [];
  const rowNumbers: number[] = [];
  let cursor = 0;
  let physicalLine = 1;

  Papa.parse<string[]>(input, {
    delimiter: ",",
    header: false,
    skipEmptyLines: false,
    dynamicTyping: false,
    step: (result) => {
      const startLine = physicalLine;
      const chunk = input.slice(cursor, result.meta.cursor);
      physicalLine += (chunk.match(/\r\n|\r|\n/g) ?? []).length;
      cursor = result.meta.cursor;

      if (result.errors.length) {
        throw new Error(
          `${filename}: CSV parse error near line ${startLine}: ${result.errors[0]?.message}`
        );
      }
      const values = result.data.map((value) => String(value ?? ""));
      if (values.every((value) => value.trim() === "")) return;

      if (headers.length === 0) {
        headers = values.map((value) => value.trim());
        if (headers.some((value) => !value)) {
          throw new Error(`${filename}: empty column header at line ${startLine}`);
        }
        const normalized = headers.map((value) => value.toLowerCase());
        if (new Set(normalized).size !== normalized.length) {
          throw new Error(`${filename}: duplicate column headers`);
        }
        return;
      }

      if (values.length !== headers.length) {
        throw new Error(
          `${filename}: line ${startLine} has ${values.length} columns; expected ${headers.length}`
        );
      }
      rows.push(Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
      rowNumbers.push(startLine);
    },
  });

  if (headers.length === 0 || rows.length === 0) {
    throw new Error(`${filename}: CSV must contain headers and at least one data row`);
  }

  return {
    name: filename.replace(/\.csv$/i, "").toLowerCase(),
    filename,
    headers,
    rows,
    rowNumbers,
  };
}

export async function readCsvFile(file: File): Promise<ParsedCsv> {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    throw new Error(`${file.name}: only .csv files are supported`);
  }
  if (file.size === 0 || file.size > MAX_CSV_BYTES) {
    throw new Error(`${file.name}: file must be between 1 byte and 1 MB`);
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    throw new Error(`${file.name}: file must be valid UTF-8 text`);
  }
  return parseCsvText(text, file.name);
}
