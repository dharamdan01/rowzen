import type { ColumnExportChoice } from "./contracts";
import { MYSQL_LIMITS, MysqlExportError, type MysqlType } from "./mysql-contracts";

export function mysqlUtf8(value: string): Uint8Array {
  const bytes = new TextEncoder().encode(value);
  if (new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes) !== value) throw new MysqlExportError("INVALID_VALUE");
  return bytes;
}
/** MySQL literals only: never PostgreSQL casts, LOAD DATA escaping or spreadsheet protection. */
export function encodeMysqlCell(value: unknown, type: MysqlType, emptyPolicy: ColumnExportChoice["emptyPolicy"]): { sql: string; key: string | null; convertedNull: boolean } {
  if (typeof value !== "string") throw new MysqlExportError("INVALID_SNAPSHOT");
  const bytes = mysqlUtf8(value);
  if (bytes.length > MYSQL_LIMITS.valueBytes) throw new MysqlExportError("OVERSIZED");
  if (emptyPolicy === "EMPTY_STRING_AS_MISSING") throw new MysqlExportError("INVALID_OPTIONS");
  if (value === "") {
    if (emptyPolicy === "REJECT_EMPTY") throw new MysqlExportError("EMPTY_REJECTED");
    if (emptyPolicy === "EMPTY_STRING_AS_NULL") return { sql: "NULL", key: null, convertedNull: true };
  }
  const text = () => `CONVERT(X'${Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("")}' USING utf8mb4)`;
  let key = value, sql: string;
  switch (type.kind) {
    case "LONGTEXT": sql = text(); break;
    case "VARCHAR":
      if ([...value].length > type.length) throw new MysqlExportError("OUT_OF_RANGE");
      sql = text(); break;
    case "TINYINT": case "SMALLINT": case "INT": case "BIGINT": {
      if (!/^[+-]?\d+$/.test(value)) throw new MysqlExportError("INVALID_VALUE");
      const digits = value.replace(/^[+-]/, "").replace(/^0+/, "") || "0";
      if (digits.length > 19) throw new MysqlExportError("OUT_OF_RANGE");
      const integer = BigInt((value.startsWith("-") ? "-" : "") + digits);
      const bounds = { TINYINT: ["-128", "127"], SMALLINT: ["-32768", "32767"], INT: ["-2147483648", "2147483647"], BIGINT: ["-9223372036854775808", "9223372036854775807"] };
      const [min, max] = bounds[type.kind];
      if (integer < BigInt(min) || integer > BigInt(max)) throw new MysqlExportError("OUT_OF_RANGE");
      key = integer.toString(); sql = key; break;
    }
    case "DECIMAL": {
      const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))$/.exec(value);
      if (!match) throw new MysqlExportError("INVALID_VALUE");
      const integer = (match[2] ?? "").replace(/^0+/, "") || "0", fraction = match[3] ?? match[4] ?? "";
      if ((integer === "0" ? 0 : integer.length) > type.precision - type.scale || fraction.length > type.scale) throw new MysqlExportError("PRECISION_LOSS");
      const canonicalFraction = fraction.replace(/0+$/, "");
      key = `${match[1] === "-" && (integer !== "0" || canonicalFraction) ? "-" : ""}${integer}${canonicalFraction ? "." + canonicalFraction : ""}`;
      sql = key; break;
    }
    case "BOOLEAN":
      if (!/^(true|false)$/i.test(value)) throw new MysqlExportError("INVALID_VALUE");
      key = value.toLowerCase() === "true" ? "1" : "0"; sql = key; break;
    case "DATE": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new MysqlExportError("INVALID_VALUE");
      const [year, month, day] = value.split("-").map(Number), date = new Date(0);
      date.setUTCFullYear(year, month - 1, day); date.setUTCHours(0, 0, 0, 0);
      if (year < 1000 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new MysqlExportError("OUT_OF_RANGE");
      sql = `CAST(${text()} AS DATE)`; break;
    }
  }
  return { sql, key, convertedNull: false };
}
