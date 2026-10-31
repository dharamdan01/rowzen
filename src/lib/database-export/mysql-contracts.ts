import { z } from "zod";
import { databaseExportRevisionsSchema, type StorageFamily } from "./contracts";

export const mysqlTypeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("LONGTEXT") }).strict(),
  z.object({ kind: z.literal("VARCHAR"), length: z.number().int().min(1).max(16_383) }).strict(),
  z.object({ kind: z.literal("TINYINT") }).strict(),
  z.object({ kind: z.literal("SMALLINT") }).strict(),
  z.object({ kind: z.literal("INT") }).strict(),
  z.object({ kind: z.literal("BIGINT") }).strict(),
  z.object({ kind: z.literal("DECIMAL"), precision: z.number().int().min(1).max(65), scale: z.number().int().min(0).max(30) }).strict(),
  z.object({ kind: z.literal("BOOLEAN") }).strict(),
  z.object({ kind: z.literal("DATE") }).strict(),
]).refine(type => type.kind !== "DECIMAL" || type.scale <= type.precision);
export type MysqlType = z.infer<typeof mysqlTypeSchema>;
export const mysqlOptionsSchema = z.object({
  revisions: databaseExportRevisionsSchema,
  database: z.string().min(1).max(256),
  profile: z.literal("MYSQL_8_INNODB_UTF8MB4_0900_BIN"),
  acknowledgeNonAtomicDdl: z.literal(true),
  columns: z.array(z.object({ columnId: z.string().min(1).max(32_768), type: mysqlTypeSchema }).strict()).min(1).max(5_000),
}).strict();
export type MysqlOptions = z.infer<typeof mysqlOptionsSchema>;
export function mysqlStorageFamily(type: MysqlType): StorageFamily {
  switch (type.kind) {
    case "LONGTEXT": case "VARCHAR": return "TEXT";
    case "TINYINT": case "SMALLINT": case "INT": case "BIGINT": return "INTEGER";
    case "DECIMAL": return "EXACT_DECIMAL";
    case "BOOLEAN": return "BOOLEAN";
    case "DATE": return "DATE_ONLY";
  }
}
export const MYSQL_LIMITS = Object.freeze({ rows: 100_000, cells: 250_000, valueBytes: 1_048_576,
  sqlBytes: 32 * 1024 * 1024, schemaBytes: 8 * 1024 * 1024, columns: 1_017, keyColumns: 16, keyBytes: 3_072,
  secondaryIndexes: 64, rowBudget: 7_000 });
export class MysqlExportError extends Error {
  constructor(readonly code: keyof typeof mysqlMessages,
    readonly location?: { datasetId: string; columnId: string; rowNumber: number }) {
    super(mysqlMessages[code]); this.name = "MysqlExportError";
  }
}
export const mysqlMessages = {
  INVALID_OPTIONS: "Choose current MySQL types, database, empty policies and acknowledge the explicit InnoDB profile and non-atomic DDL.",
  INVALID_IDENTIFIER: "MySQL names must be valid BMP Unicode, at most 64 characters, without controls, backslashes or trailing spaces. Reserved database/table names and case-insensitive collisions are unsupported.",
  UNSUPPORTED_SCHEMA: "Resolve the current configuration, target choices and metadata-only rule acknowledgements before exporting.",
  UNSUPPORTED_TYPE: "This conversion or indexed type is unsupported. Use bounded VARCHAR for text keys; no prefix index or silent conversion is generated.",
  INCOMPATIBLE_FOREIGN_KEY: "Foreign-key pairs require matching MySQL types and a complete ordered declared primary/unique target key.",
  OVERSIZED: "The MySQL export exceeds its supported row, cell, value, SQL, table or InnoDB index/row-size budget.",
  INVALID_SNAPSHOT: "The current approved snapshot contains missing, extra or invalid records/columns.",
  INVALID_VALUE: "A value has invalid Unicode or an unsupported strict MySQL primitive format. No trimming, repair or implicit NULL conversion occurs.",
  EMPTY_REJECTED: "An exact empty value conflicts with the approved policy. No records were omitted.",
  OUT_OF_RANGE: "A value exceeds the selected MySQL integer, VARCHAR or DATE bounds (dates 1000–9999).",
  PRECISION_LOSS: "DECIMAL requires exact plain notation within the chosen precision/scale (maximum 65/30). Rounding is rejected.",
  DUPLICATE_KEY: "Converted values would violate a primary or unique key under the explicit binary NO PAD profile.",
  FOREIGN_KEY_NOT_FOUND: "Converted values contain an unmatched foreign key. Review exact values and NULL policies.",
  STALE: "The workspace, MySQL choices or consent changed. Prepare a fresh export.",
} as const;
