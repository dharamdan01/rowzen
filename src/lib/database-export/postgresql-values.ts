import type { ColumnExportChoice } from "./contracts";
import { renderPostgresType, type PostgresType } from "./postgresql";

export const POSTGRES_DATA_LIMITS = Object.freeze({ rows: 100_000, cells: 250_000, valueBytes: 1_048_576, sqlBytes: 32 * 1024 * 1024 });
export type PostgresDataErrorCode = "INVALID_SNAPSHOT" | "INVALID_TEXT" | "EMPTY_REJECTED" | "TYPE_FORMAT" | "OUT_OF_RANGE" |
  "PRECISION_LOSS" | "UNSUPPORTED_FLOAT" | "DUPLICATE_KEY" | "FOREIGN_KEY_NOT_FOUND" | "OVERSIZED";
export class PostgresDataError extends Error {
  constructor(readonly code: PostgresDataErrorCode, readonly location?: { datasetId: string; rowNumber: number; columnId: string }) {
    super(postgresDataMessages[code]); this.name = "PostgresDataError";
  }
}
export const postgresDataMessages: Record<PostgresDataErrorCode, string> = {
  INVALID_SNAPSHOT: "The current snapshot has missing, extra or invalid records/columns. Revalidate before exporting.",
  INVALID_TEXT: "A cell contains NUL or invalid Unicode, which this PostgreSQL export cannot preserve.",
  EMPTY_REJECTED: "An empty cell conflicts with its approved target policy. No rows were exported.",
  TYPE_FORMAT: "A cell does not match the strict target format. Whitespace and literal NULL tokens are not converted automatically.",
  OUT_OF_RANGE: "A cell exceeds its PostgreSQL integer, date or VARCHAR bounds.",
  PRECISION_LOSS: "A decimal exceeds the approved precision/scale. Rounding is not permitted.",
  UNSUPPORTED_FLOAT: "DOUBLE PRECISION record export is deferred. Choose exact NUMERIC or text explicitly.",
  DUPLICATE_KEY: "The approved target conversions would violate a primary or unique key. No records were omitted or repaired.",
  FOREIGN_KEY_NOT_FOUND: "The approved target conversions leave an unmatched foreign key. Review exact values and NULL policies.",
  OVERSIZED: "The record export exceeds the supported row, cell, value or SQL file size limit.",
};

const decimal = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))$/;
function decimalKey(value: string): string {
  const match = decimal.exec(value)!;
  const integer = (match[2] ?? "0").replace(/^0+/, "") || "0";
  const fraction = (match[3] ?? match[4] ?? "").replace(/0+$/, "");
  return `${match[1] === "-" && (integer !== "0" || fraction) ? "-" : ""}${integer}${fraction ? "." + fraction : ""}`;
}
function dateCompatible(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/** No trim, spreadsheet sanitization, floating-point conversion or speculative NULL tokens. */
export function encodePostgresDataCell(value: unknown, type: PostgresType, emptyPolicy: ColumnExportChoice["emptyPolicy"]): { sql: string; key: string | null; convertedNull: boolean } {
  if (typeof value !== "string") throw new PostgresDataError("INVALID_SNAPSHOT");
  const bytes = new TextEncoder().encode(value);
  if (bytes.length > POSTGRES_DATA_LIMITS.valueBytes) throw new PostgresDataError("OVERSIZED");
  if (value.includes("\0") || new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes) !== value) throw new PostgresDataError("INVALID_TEXT");
  if (value === "") {
    if (emptyPolicy === "REJECT_EMPTY") throw new PostgresDataError("EMPTY_REJECTED");
    if (emptyPolicy === "EMPTY_STRING_AS_NULL") return { sql: "NULL", key: null, convertedNull: true };
  }
  let key = value;
  switch (type.kind) {
    case "TEXT": break;
    case "VARCHAR":
      if ([...value].length > type.length) throw new PostgresDataError("OUT_OF_RANGE");
      break;
    case "SMALLINT": case "INTEGER": case "BIGINT": {
      if (!/^[-+]?\d+$/.test(value)) throw new PostgresDataError("TYPE_FORMAT");
      const digits = value.replace(/^[-+]/, "").replace(/^0+/, "") || "0";
      if (digits.length > 19) throw new PostgresDataError("OUT_OF_RANGE");
      const integer = BigInt(`${value.startsWith("-") ? "-" : ""}${digits}`);
      const [min, max] = type.kind === "SMALLINT" ? ["-32768", "32767"] : type.kind === "INTEGER" ?
        ["-2147483648", "2147483647"] : ["-9223372036854775808", "9223372036854775807"];
      if (integer < BigInt(min) || integer > BigInt(max)) throw new PostgresDataError("OUT_OF_RANGE");
      key = integer.toString(); break;
    }
    case "NUMERIC": {
      const match = decimal.exec(value);
      if (!match) throw new PostgresDataError("TYPE_FORMAT");
      const integerDigits = (match[2] ?? "").replace(/^0+/, "").length;
      const fractionDigits = (match[3] ?? match[4] ?? "").length;
      if (integerDigits > type.precision - type.scale || fractionDigits > type.scale) throw new PostgresDataError("PRECISION_LOSS");
      key = decimalKey(value); break;
    }
    case "BOOLEAN":
      if (!/^(true|false)$/i.test(value)) throw new PostgresDataError("TYPE_FORMAT");
      key = value.toLowerCase(); break;
    case "DATE":
      if (!dateCompatible(value)) throw new PostgresDataError("OUT_OF_RANGE");
      break;
    case "DOUBLE_PRECISION": throw new PostgresDataError("UNSUPPORTED_FLOAT");
  }
  // Only hexadecimal digits enter a SQL literal. All executable syntax is application-owned.
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return { sql: `pg_catalog.convert_from(pg_catalog.decode('${hex}', 'hex'), 'UTF8')::${renderPostgresType(type)}`, key, convertedNull: false };
}
