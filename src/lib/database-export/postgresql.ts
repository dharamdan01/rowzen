import { z } from "zod";
import { databaseExportRevisionsSchema, sameExportRevisions, type StorageFamily } from "./contracts";
import { freezeExport, type DatabaseExportManifest, type DatabaseExportPlan } from "./types";

export const postgresTypeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("TEXT") }).strict(),
  z.object({ kind: z.literal("SMALLINT") }).strict(),
  z.object({ kind: z.literal("INTEGER") }).strict(),
  z.object({ kind: z.literal("BIGINT") }).strict(),
  z.object({ kind: z.literal("DOUBLE_PRECISION") }).strict(),
  z.object({ kind: z.literal("BOOLEAN") }).strict(),
  z.object({ kind: z.literal("DATE") }).strict(),
  z.object({ kind: z.literal("VARCHAR"), length: z.number().int().min(1).max(1_000_000) }).strict(),
  z.object({ kind: z.literal("NUMERIC"), precision: z.number().int().min(1).max(1_000), scale: z.number().int().min(0).max(1_000) }).strict(),
]).refine(type => type.kind !== "NUMERIC" || type.scale <= type.precision, "Scale must not exceed precision.");
export type PostgresType = z.infer<typeof postgresTypeSchema>;
export const postgresSchemaOptionsSchema = z.object({
  revisions: databaseExportRevisionsSchema,
  namespace: z.string().min(1).max(256),
  columns: z.array(z.object({ columnId: z.string().min(1).max(32_768), type: postgresTypeSchema }).strict()).min(1).max(5_000),
}).strict();
export type PostgresSchemaOptions = z.infer<typeof postgresSchemaOptionsSchema>;

export class PostgresSchemaError extends Error {
  constructor(readonly code: "INVALID_OPTIONS" | "INVALID_IDENTIFIER" | "UNSUPPORTED_TYPE" | "INCOMPATIBLE_FOREIGN_KEY" | "UNSUPPORTED_SCHEMA" | "STALE" | "OVERSIZED") {
    super(postgresSchemaMessages[code]); this.name = "PostgresSchemaError";
  }
}
export const postgresSchemaMessages = {
  INVALID_OPTIONS: "Choose an explicit PostgreSQL type and valid options for every column.",
  INVALID_IDENTIFIER: "A schema, table or column name is invalid for this PostgreSQL export (maximum 63 UTF-8 bytes; no control characters or system column names).",
  UNSUPPORTED_TYPE: "A PostgreSQL type does not match its approved storage family.",
  INCOMPATIBLE_FOREIGN_KEY: "Use exactly matching PostgreSQL types and type options for each foreign-key pair.",
  UNSUPPORTED_SCHEMA: "Resolve configuration errors and acknowledge target differences before exporting a schema.",
  STALE: "The workspace or export choices changed. Generate a new PostgreSQL preview.",
  OVERSIZED: "This schema exceeds the supported PostgreSQL export limits.",
} as const;

export function quotePostgresIdentifier(value: string): string {
  if (!value || /[\u0000-\u001f\u007f]/u.test(value) || new TextEncoder().encode(value).length > 63 ||
      new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(new TextEncoder().encode(value)) !== value) {
    throw new PostgresSchemaError("INVALID_IDENTIFIER");
  }
  return `"${value.replaceAll('"', '""')}"`;
}

export function postgresStorageFamily(type: PostgresType): StorageFamily {
  switch (type.kind) {
    case "TEXT": case "VARCHAR": return "TEXT";
    case "SMALLINT": case "INTEGER": case "BIGINT": return "INTEGER";
    case "NUMERIC": return "EXACT_DECIMAL";
    case "DOUBLE_PRECISION": return "FLOATING_POINT";
    case "BOOLEAN": return "BOOLEAN";
    case "DATE": return "DATE_ONLY";
  }
}
export function renderPostgresType(type: PostgresType): string {
  switch (type.kind) {
    case "TEXT": return "pg_catalog.text";
    case "VARCHAR": return `pg_catalog.varchar(${type.length})`;
    case "SMALLINT": return "pg_catalog.int2";
    case "INTEGER": return "pg_catalog.int4";
    case "BIGINT": return "pg_catalog.int8";
    case "NUMERIC": return `pg_catalog.numeric(${type.precision}, ${type.scale})`;
    case "DOUBLE_PRECISION": return "pg_catalog.float8";
    case "BOOLEAN": return "pg_catalog.bool";
    case "DATE": return "pg_catalog.date";
  }
}

export interface PostgresSchemaArtifact {
  readonly filename: "datarehearsal-postgresql-schema.sql";
  readonly contentType: "application/sql;charset=utf-8";
  readonly content: string;
  readonly manifest: DatabaseExportManifest & {
    readonly renderer: "POSTGRESQL_SCHEMA_V1";
    readonly namespace: string;
    readonly physicalColumns: PostgresSchemaOptions["columns"];
    readonly constraintNames: readonly { readonly id: string; readonly name: string }[];
    readonly execution: "NOT_EXECUTED";
  };
}
const ownedSchemaSections = new WeakMap<PostgresSchemaArtifact, { plan: DatabaseExportPlan; tables: readonly string[]; foreignKeys: readonly string[] }>();
/** Owned statements only: never split SQL containing quoted user-controlled identifiers. */
export function getPostgresSchemaSections(artifact: PostgresSchemaArtifact, plan: DatabaseExportPlan) {
  const sections = ownedSchemaSections.get(artifact);
  if (!sections || sections.plan !== plan) throw new PostgresSchemaError("STALE");
  return sections;
}

/** All tables/keys precede FK ALTERs. No rows, DB client, SQL expressions or execution. */
export function preparePostgresSchemaExport(plan: DatabaseExportPlan, input: unknown, assertCurrent: () => void): PostgresSchemaArtifact {
  assertCurrent();
  const parsed = postgresSchemaOptionsSchema.safeParse(input);
  if (!parsed.success) throw new PostgresSchemaError("INVALID_OPTIONS");
  const options = parsed.data;
  if (!sameExportRevisions(options.revisions, plan.revisions)) throw new PostgresSchemaError("STALE");
  if (plan.status !== "PLANNED" || plan.manifest.target !== "POSTGRESQL" || plan.manifest.mode !== "SCHEMA_ONLY" ||
      plan.manifest.schema.configurationState !== "DESCRIBED") throw new PostgresSchemaError("UNSUPPORTED_SCHEMA");
  const schema = plan.manifest.schema;
  const namespace = quotePostgresIdentifier(options.namespace);
  if (options.namespace.toLowerCase().startsWith("pg_") || options.namespace.toLowerCase() === "information_schema") throw new PostgresSchemaError("INVALID_IDENTIFIER");
  const physical = new Map(options.columns.map(column => [column.columnId, column.type]));
  const choices = new Map(plan.manifest.choices.map(choice => [choice.columnId, choice]));
  const allColumns = schema.datasets.flatMap(dataset => dataset.columns);
  const columnIds = new Set(allColumns.map(column => column.id));
  if (physical.size !== options.columns.length || physical.size !== allColumns.length || [...physical.keys()].some(id => !columnIds.has(id))) throw new PostgresSchemaError("INVALID_OPTIONS");
  const systemColumns = new Set(["tableoid", "xmin", "cmin", "xmax", "cmax", "ctid"]);
  for (const dataset of schema.datasets) {
    quotePostgresIdentifier(dataset.name);
    if (dataset.columns.length > 1_600) throw new PostgresSchemaError("OVERSIZED");
    for (const column of dataset.columns) {
      if (!column.target || systemColumns.has(column.target)) throw new PostgresSchemaError("INVALID_IDENTIFIER");
      quotePostgresIdentifier(column.target);
      if (postgresStorageFamily(physical.get(column.id)!) !== choices.get(column.id)?.storage) throw new PostgresSchemaError("UNSUPPORTED_TYPE");
    }
  }
  const tableNames = new Set(schema.datasets.map(dataset => dataset.name));
  const constraintNames: { id: string; name: string }[] = [];
  let ordinal = 0;
  const constraintName = (id: string) => {
    let name: string;
    do { name = `dr_pg_constraint_${ordinal++}`; } while (tableNames.has(name));
    tableNames.add(name); constraintNames.push({ id, name }); return quotePostgresIdentifier(name);
  };
  const qualified = (name: string) => `${namespace}.${quotePostgresIdentifier(name)}`;
  const statements = ["-- Rowzen: PostgreSQL schema only. No records or database execution.",
    "-- Requires an existing destination schema and new table names. Existing objects cause failure.",
    "-- Review the companion manifest: configured preflight is not database compatibility.", "BEGIN;"];
  const tables: string[] = [], foreignKeys: string[] = [];
  for (const dataset of schema.datasets) {
    const definitions = dataset.columns.map(column => `  ${quotePostgresIdentifier(column.target!)} ${renderPostgresType(physical.get(column.id)!)}${choices.get(column.id)!.emptyPolicy === "REJECT_EMPTY" ? " NOT NULL" : ""}`);
    for (const key of schema.keys.filter(key => key.dataset === dataset.name && key.effective)) {
      if (key.columns.length > 32) throw new PostgresSchemaError("OVERSIZED");
      definitions.push(`  CONSTRAINT ${constraintName(key.id)} ${key.kind === "PRIMARY" ? "PRIMARY KEY" : "UNIQUE"} (${key.columns.map(column => quotePostgresIdentifier(column.target!)).join(", ")})`);
    }
    const statement = `CREATE TABLE ${qualified(dataset.name)} (\n${definitions.join(",\n")}\n);`;
    statements.push(statement); tables.push(statement);
  }
  for (const fk of schema.foreignKeys) {
    if (fk.pairs.length > 32) throw new PostgresSchemaError("OVERSIZED");
    for (const pair of fk.pairs) {
      if (!pair.child.columnId || !pair.parent.columnId || JSON.stringify(physical.get(pair.child.columnId)) !== JSON.stringify(physical.get(pair.parent.columnId))) {
        throw new PostgresSchemaError("INCOMPATIBLE_FOREIGN_KEY");
      }
    }
    const statement = `ALTER TABLE ${qualified(fk.childDataset)} ADD CONSTRAINT ${constraintName(fk.id)} FOREIGN KEY (${fk.pairs.map(pair => quotePostgresIdentifier(pair.child.target!)).join(", ")}) REFERENCES ${qualified(fk.parentDataset)} (${fk.pairs.map(pair => quotePostgresIdentifier(pair.parent.target!)).join(", ")});`;
    statements.push(statement); foreignKeys.push(statement);
  }
  statements.push("COMMIT;", "");
  const content = statements.join("\n\n");
  if (new TextEncoder().encode(content).length > 8 * 1024 * 1024) throw new PostgresSchemaError("OVERSIZED");
  assertCurrent();
  const implemented = (finding: DatabaseExportManifest["warnings"][number]) => finding.code !== "TARGET_ADAPTER_NOT_IMPLEMENTED";
  const artifact: PostgresSchemaArtifact = freezeExport({ filename: "datarehearsal-postgresql-schema.sql", contentType: "application/sql;charset=utf-8", content,
    manifest: { ...plan.manifest, warnings: plan.manifest.warnings.filter(implemented), unsupportedFeatures: plan.manifest.unsupportedFeatures.filter(implemented),
      assumptions: [...plan.manifest.assumptions, "All tables and keys are created before foreign keys; cycles are supported for empty schema creation only.",
        "No existing schema/table migration, data compatibility, NULL conversion, collation or target server was verified.",
        "REJECT_EMPTY emits NOT NULL only; required nonblank/email checks remain application rules. No CHECK or cascade action is inferred.",
        "Built-in types are pg_catalog-qualified; all supplied identifiers are quoted without truncation or renaming."],
      renderer: "POSTGRESQL_SCHEMA_V1", namespace: options.namespace,
      physicalColumns: allColumns.map(column => ({ columnId: column.id, type: physical.get(column.id)! })), constraintNames, execution: "NOT_EXECUTED" } });
  ownedSchemaSections.set(artifact, Object.freeze({ plan, tables: Object.freeze(tables), foreignKeys: Object.freeze(foreignKeys) }));
  return artifact;
}
