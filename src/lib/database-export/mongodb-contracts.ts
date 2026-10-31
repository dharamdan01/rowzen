import { z } from "zod";
import { columnExportChoiceSchema, databaseExportRevisionsSchema, type StorageFamily } from "./contracts";

export const mongoTypeSchema = z.enum(["STRING", "INT32", "INT64", "DECIMAL128", "BOOLEAN", "DATE_UTC_MIDNIGHT"]);
export type MongoType = z.infer<typeof mongoTypeSchema>;
export const mongoOptionsSchema = z.object({
  revisions: databaseExportRevisionsSchema,
  columns: z.array(z.object({ columnId: z.string().min(1).max(32_768), type: mongoTypeSchema,
    emptyPolicy: columnExportChoiceSchema.shape.emptyPolicy }).strict()).min(1).max(5_000),
  collections: z.array(z.object({ datasetId: z.string().min(1).max(32_768), name: z.string().min(1).max(512),
    idPolicy: z.enum(["PRESERVE_CONFIGURED_ID", "ALLOW_SERVER_GENERATED_ID"]) }).strict()).min(1).max(100),
  includeValidators: z.boolean().default(false), includeUniqueIndexes: z.boolean().default(false),
  acknowledgeMongoSemantics: z.literal(true),
}).strict();
export type MongoOptions = z.infer<typeof mongoOptionsSchema>;
export function mongoStorageFamily(type: MongoType): StorageFamily {
  switch (type) {
    case "STRING": return "TEXT";
    case "INT32": case "INT64": return "INTEGER";
    case "DECIMAL128": return "EXACT_DECIMAL";
    case "BOOLEAN": return "BOOLEAN";
    case "DATE_UTC_MIDNIGHT": return "DATE_ONLY";
  }
}
export const MONGO_EXPORT_LIMITS = Object.freeze({ rows: 100_000, cells: 250_000, valueBytes: 1_048_576,
  documentBytes: 8 * 1024 * 1024, totalBytes: 32 * 1024 * 1024, fieldNameBytes: 256, collectionNameBytes: 120 });
export class MongoExportError extends Error {
  constructor(readonly code: "INVALID_OPTIONS" | "UNSUPPORTED_NAME" | "UNSUPPORTED_TYPE" | "INVALID_VALUE" | "OUT_OF_RANGE" |
    "DECIMAL_PRECISION" | "EMPTY_REJECTED" | "DUPLICATE_KEY" | "INVALID_SNAPSHOT" | "OVERSIZED" | "STALE",
    readonly location?: { datasetId: string; columnId: string; rowNumber: number }) {
    super(mongoExportMessages[code]); this.name = "MongoExportError";
  }
}
export const mongoExportMessages = {
  INVALID_OPTIONS: "Choose complete current MongoDB types, empty policies, collections and explicit _id handling.",
  UNSUPPORTED_NAME: "This MongoDB profile rejects empty/control names, dollar/dotted field names, reserved collections and oversized labels. Apply explicit valid mappings; names are never silently rewritten.",
  UNSUPPORTED_TYPE: "The MongoDB type or empty policy does not match the approved configuration.",
  INVALID_VALUE: "A value has an unsupported primitive format or invalid Unicode. No JSON objects, arrays or code are inferred from cell text.",
  OUT_OF_RANGE: "A value exceeds the selected BSON integer or supported date range.",
  DECIMAL_PRECISION: "Decimal128 export requires exact plain decimal notation with at most 34 significant digits and 6176 fractional places. Rounding/exponent input is unsupported.",
  EMPTY_REJECTED: "An empty value conflicts with a required field, declared primary-key field or explicit _id policy.",
  DUPLICATE_KEY: "Converted values violate an _id or declared unique-key group under MongoDB null/missing equality. No records were omitted.",
  INVALID_SNAPSHOT: "The current approved snapshot contains missing, extra or invalid CSV records/columns.",
  OVERSIZED: "This MongoDB export exceeds the supported document, row, cell, value or total-size limit.",
  STALE: "The workspace, consent or MongoDB choices changed. Prepare a new export.",
} as const;
