import type { ColumnExportChoice } from "./contracts";
import { MONGO_EXPORT_LIMITS, MongoExportError, type MongoType } from "./mongodb-contracts";

export type MongoPrimitive = string | boolean | null | { $numberInt: string } | { $numberLong: string } |
  { $numberDecimal: string } | { $date: { $numberLong: string } };
export function assertMongoUnicode(value: string): Uint8Array {
  const bytes = new TextEncoder().encode(value);
  if (new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes) !== value) throw new MongoExportError("INVALID_VALUE");
  return bytes;
}
export function assertMongoFieldName(value: string) {
  if (!value || /[.$\u0000-\u001f\u007f]/u.test(value) || assertMongoUnicode(value).length > MONGO_EXPORT_LIMITS.fieldNameBytes) throw new MongoExportError("UNSUPPORTED_NAME");
}
export function assertMongoCollectionName(value: string) {
  if (!value || value.startsWith("system.") || /[$/\\\u0000-\u001f\u007f]/u.test(value) || assertMongoUnicode(value).length > MONGO_EXPORT_LIMITS.collectionNameBytes) throw new MongoExportError("UNSUPPORTED_NAME");
}

export function encodeMongoCell(value: unknown, type: MongoType, empty: ColumnExportChoice["emptyPolicy"]): { value: MongoPrimitive | undefined; key: string | null } {
  if (typeof value !== "string") throw new MongoExportError("INVALID_SNAPSHOT");
  if (assertMongoUnicode(value).length > MONGO_EXPORT_LIMITS.valueBytes) throw new MongoExportError("OVERSIZED");
  if (value === "") {
    if (empty === "REJECT_EMPTY") throw new MongoExportError("EMPTY_REJECTED");
    if (empty === "EMPTY_STRING_AS_NULL") return { value: null, key: null };
    if (empty === "EMPTY_STRING_AS_MISSING") return { value: undefined, key: null };
  }
  switch (type) {
    case "STRING": return { value, key: value };
    case "BOOLEAN": {
      if (!/^(true|false)$/i.test(value)) throw new MongoExportError("INVALID_VALUE");
      return { value: value.toLowerCase() === "true", key: value.toLowerCase() };
    }
    case "INT32": case "INT64": {
      if (!/^[+-]?\d+$/.test(value)) throw new MongoExportError("INVALID_VALUE");
      const digits = value.replace(/^[+-]/, "").replace(/^0+/, "") || "0";
      if (digits.length > 19) throw new MongoExportError("OUT_OF_RANGE");
      const integer = BigInt((value.startsWith("-") ? "-" : "") + digits);
      const [min, max] = type === "INT32" ? ["-2147483648", "2147483647"] : ["-9223372036854775808", "9223372036854775807"];
      if (integer < BigInt(min) || integer > BigInt(max)) throw new MongoExportError("OUT_OF_RANGE");
      const key = integer.toString();
      return { value: type === "INT32" ? { $numberInt: key } : { $numberLong: key }, key };
    }
    case "DECIMAL128": {
      const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))$/.exec(value);
      if (!match) throw new MongoExportError("DECIMAL_PRECISION");
      const integer = (match[2] ?? "").replace(/^0+/, "") || "0", fraction = match[3] ?? match[4] ?? "";
      const significant = (integer + fraction).replace(/^0+/, "") || "0";
      if (significant.length > 34 || fraction.length > 6176) throw new MongoExportError("DECIMAL_PRECISION");
      const keyFraction = fraction.replace(/0+$/, "");
      const key = `${match[1] === "-" && (integer !== "0" || keyFraction) ? "-" : ""}${integer}${keyFraction ? "." + keyFraction : ""}`;
      return { value: { $numberDecimal: value }, key };
    }
    case "DATE_UTC_MIDNIGHT": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new MongoExportError("INVALID_VALUE");
      const [year, month, day] = value.split("-").map(Number), date = new Date(0);
      date.setUTCFullYear(year, month - 1, day); date.setUTCHours(0, 0, 0, 0);
      if (year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new MongoExportError("OUT_OF_RANGE");
      const key = String(date.getTime()); return { value: { $date: { $numberLong: key } }, key };
    }
  }
}
