import { sameExportRevisions } from "./contracts";
import { freezeExport, type DatabaseExportManifest, type DatabaseExportPlan } from "./types";
import { MYSQL_LIMITS, MysqlExportError, mysqlOptionsSchema, mysqlStorageFamily, type MysqlOptions, type MysqlType } from "./mysql-contracts";
import { mysqlUtf8 } from "./mysql-values";

export function quoteMysqlIdentifier(value: string): string {
  if (!value || value.length > 64 || /[\u0000-\u001f\u007f\\\ud800-\udfff]/u.test(value) || /[^\u0000-\uffff]/u.test(value) || value.endsWith(" ")) throw new MysqlExportError("INVALID_IDENTIFIER");
  mysqlUtf8(value);
  return "`" + value.replaceAll("`", "``") + "`";
}
function tableIdentifier(value: string): string {
  if (/[./]/.test(value) || /^#sql/i.test(value) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(value)) throw new MysqlExportError("INVALID_IDENTIFIER");
  return quoteMysqlIdentifier(value);
}
export function renderMysqlType(type: MysqlType): string {
  switch (type.kind) {
    case "VARCHAR": return `VARCHAR(${type.length})`;
    case "DECIMAL": return `DECIMAL(${type.precision}, ${type.scale})`;
    case "BOOLEAN": return "TINYINT";
    default: return type.kind;
  }
}
function indexBytes(type: MysqlType): number {
  switch (type.kind) {
    case "LONGTEXT": throw new MysqlExportError("UNSUPPORTED_TYPE");
    case "VARCHAR": return type.length * 4;
    case "TINYINT": case "BOOLEAN": return 1;
    case "SMALLINT": return 2;
    case "INT": return 4;
    case "BIGINT": return 8;
    case "DATE": return 3;
    case "DECIMAL": return 32; // Conservative bound including DECIMAL(65,30).
  }
}
export const MYSQL_PREAMBLE = Object.freeze([
  "-- Rowzen MySQL 8.0.30+/8.4 InnoDB profile; new tables in an existing database only.",
  "-- DDL implicitly commits. This file is NOT an atomic restore or migration. Stop on the first error.",
  "SET NAMES utf8mb4 COLLATE utf8mb4_0900_bin;",
  "SET SESSION sql_mode = 'STRICT_ALL_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION,NO_BACKSLASH_ESCAPES';",
  "SET SESSION foreign_key_checks = 1;",
]);
export interface MysqlSchemaArtifact {
  readonly filename: "datarehearsal-mysql-schema.sql";
  readonly contentType: "application/sql;charset=utf-8";
  readonly content: string;
  readonly instructions: string;
  readonly manifest: DatabaseExportManifest & {
    readonly renderer: "MYSQL_SCHEMA_V1";
    readonly database: string;
    readonly profile: MysqlOptions["profile"];
    readonly physicalColumns: MysqlOptions["columns"];
    readonly constraintNames: readonly { readonly id: string; readonly name: string }[];
    readonly execution: "NOT_EXECUTED";
    readonly atomicRestore: false;
  };
}
const ownedSections = new WeakMap<MysqlSchemaArtifact, { plan: DatabaseExportPlan; tables: readonly string[]; foreignKeys: readonly string[] }>();
export function getMysqlSections(artifact: MysqlSchemaArtifact, plan: DatabaseExportPlan) {
  const sections = ownedSections.get(artifact);
  if (!sections || sections.plan !== plan) throw new MysqlExportError("STALE");
  return sections;
}
export function mysqlInstructions(records = false): string {
  return [
    "Review the complete SQL and manifest. The application never connects to or executes against a database.",
    "Use MySQL 8.0.30+ or 8.4, InnoDB, 16 KiB or larger InnoDB pages, DYNAMIC row format and utf8mb4_0900_bin (binary NO PAD). MariaDB and older versions are not this profile.",
    "Create a fresh disposable destination database separately first. All target table names must be new. No existing object compatibility is verified.",
    `With your own reviewed connection settings run: mysql --binary-mode --default-character-set=utf8mb4 --host=<HOST> --user=<USER> --password < datarehearsal-mysql-${records ? "restore" : "schema"}.sql`,
    "Use batch input and stop on the first error. Do NOT use --force, source via a GUI that ignores errors, or disable foreign-key checks. --binary-mode disables most client commands in batch input.",
    "DDL implicitly commits: the script is NOT atomic. On any error stop, review partial objects/data and use a new reviewed destination for a retry. No DROP/cleanup or destructive recovery command is generated.",
    "The script sets strict session SQL modes, utf8mb4 encoding and enabled foreign-key checks. Use a dedicated import session; these choices differ from server defaults.",
    "PK/UNIQUE and BOOLEAN 0/1 CHECKs are created before data; all foreign keys are added afterward with checks enabled, preserving cycles and complete ordered pairs.",
    "BOOLEAN uses signed TINYINT plus an enforced 0/1 CHECK, not an unrestricted MySQL BOOLEAN alias. No cascade, default, AUTO_INCREMENT or prefix index is inferred.",
    "Required-nonblank and email format remain disclosed application rules; NOT NULL is not an equivalent nonblank/email check. No CHAR padding or case-insensitive collation is inferred.",
    ...(records ? ["SENSITIVE RECORDS: UTF-8 hex is reversible, not encryption. This restore contains schema AND every approved corrected record; do not run schema-only SQL first.",
      "Exact empty values convert only by the approved per-column policy. NULL/null/\\N and whitespace stay text. Missing source properties are errors.",
      "Values use MySQL CONVERT(X'hex' USING utf8mb4), validated exact numeric literals and explicit DATE casts, not LOAD DATA or spreadsheet-safe CSV. Dates 1000-9999 only; no floating point, rounding or implicit repair.",
      "DML uses a transaction, committed before FK ALTERs; subsequent DDL can fail after data has committed. CSV preflight READY is not a successful database import."] : ["Schema only: no CSV records or sensitive cell values."]),
    "Database version, privileges, existing constraints, storage, environment and arbitrary destination compatibility remain unverified. Preserve the manifest with the file.", "",
  ].join("\n");
}
/** Deterministic MySQL DDL only. Never connects to a database or reads records. */
export function prepareMysqlSchemaExport(plan: DatabaseExportPlan, input: unknown, assertCurrent: () => void): MysqlSchemaArtifact {
  assertCurrent();
  const parsed = mysqlOptionsSchema.safeParse(input);
  if (!parsed.success) throw new MysqlExportError("INVALID_OPTIONS");
  const options = parsed.data;
  if (!sameExportRevisions(options.revisions, plan.revisions)) throw new MysqlExportError("STALE");
  if (plan.status !== "PLANNED" || plan.manifest.target !== "MYSQL" || plan.manifest.mode !== "SCHEMA_ONLY" ||
      plan.manifest.schema.configurationState !== "DESCRIBED") throw new MysqlExportError("UNSUPPORTED_SCHEMA");
  const schema = plan.manifest.schema;
  const database = tableIdentifier(options.database);
  if (["mysql", "sys", "performance_schema", "information_schema"].includes(options.database.toLowerCase())) throw new MysqlExportError("INVALID_IDENTIFIER");
  const columns = schema.datasets.flatMap(table => table.columns), ids = new Set(columns.map(column => column.id));
  const physical = new Map(options.columns.map(column => [column.columnId, column.type]));
  const choices = new Map(plan.manifest.choices.map(choice => [choice.columnId, choice]));
  if (physical.size !== columns.length || physical.size !== options.columns.length || [...physical.keys()].some(id => !ids.has(id))) throw new MysqlExportError("INVALID_OPTIONS");
  if (new Set(schema.datasets.map(table => table.name.toLowerCase())).size !== schema.datasets.length) throw new MysqlExportError("INVALID_IDENTIFIER");
  const checkIndex = (columnIds: readonly (string | null)[]) => {
    if (!columnIds.length || columnIds.length > MYSQL_LIMITS.keyColumns ||
        columnIds.reduce<number>((sum, id) => sum + indexBytes(physical.get(id!)!), 0) > MYSQL_LIMITS.keyBytes) throw new MysqlExportError("OVERSIZED");
  };
  const names: { id: string; name: string }[] = [];
  const nextName = (id: string) => { const name = `dr_mysql_${names.length}`; names.push({ id, name }); return quoteMysqlIdentifier(name); };
  const qualified = (name: string) => `${database}.${tableIdentifier(name)}`;
  const tables: string[] = [], foreignKeys: string[] = [];
  for (const table of schema.datasets) {
    const targets = table.columns.map(column => column.target?.toLowerCase());
    if (new Set(targets).size !== targets.length) throw new MysqlExportError("INVALID_IDENTIFIER");
    if (table.columns.length > MYSQL_LIMITS.columns) throw new MysqlExportError("OVERSIZED");
    let rowBytes = 256 + Math.ceil(table.columns.length / 8);
    const definitions = table.columns.map(column => {
      if (!column.target || ["db_row_id", "db_trx_id", "db_roll_ptr"].includes(column.target.toLowerCase())) throw new MysqlExportError("INVALID_IDENTIFIER");
      const name = quoteMysqlIdentifier(column.target), type = physical.get(column.id)!;
      if (mysqlStorageFamily(type) !== choices.get(column.id)?.storage) throw new MysqlExportError("UNSUPPORTED_TYPE");
      rowBytes += type.kind === "LONGTEXT" ? 24 : type.kind === "VARCHAR" ? type.length * 4 + 2 : indexBytes(type);
      return `  ${name} ${renderMysqlType(type)}${choices.get(column.id)!.emptyPolicy === "REJECT_EMPTY" ? " NOT NULL" : " NULL"}`;
    });
    if (rowBytes > MYSQL_LIMITS.rowBudget) throw new MysqlExportError("OVERSIZED");
    const keys = schema.keys.filter(key => key.dataset === table.name && key.effective);
    if (keys.filter(key => key.kind === "UNIQUE").length + schema.foreignKeys.filter(fk => fk.childDataset === table.name).length > MYSQL_LIMITS.secondaryIndexes) throw new MysqlExportError("OVERSIZED");
    for (const key of keys) {
      checkIndex(key.columns.map(column => column.columnId));
      const fields = key.columns.map(column => quoteMysqlIdentifier(column.target!)).join(", ");
      definitions.push(key.kind === "PRIMARY" ? `  PRIMARY KEY (${fields})` : `  CONSTRAINT ${nextName(key.id)} UNIQUE (${fields})`);
    }
    for (const column of table.columns.filter(column => physical.get(column.id)!.kind === "BOOLEAN")) {
      definitions.push(`  CONSTRAINT ${nextName(JSON.stringify(["boolean", column.id]))} CHECK (${quoteMysqlIdentifier(column.target!)} IN (0, 1))`);
    }
    tables.push(`CREATE TABLE ${qualified(table.name)} (\n${definitions.join(",\n")}\n) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_0900_bin;`);
  }
  for (const fk of schema.foreignKeys) {
    checkIndex(fk.pairs.map(pair => pair.child.columnId)); checkIndex(fk.pairs.map(pair => pair.parent.columnId));
    if (!schema.keys.some(key => key.effective && key.dataset === fk.parentDataset &&
        JSON.stringify(key.columns.map(column => column.columnId)) === JSON.stringify(fk.pairs.map(pair => pair.parent.columnId))) ||
        fk.pairs.some(pair => JSON.stringify(physical.get(pair.child.columnId!)) !== JSON.stringify(physical.get(pair.parent.columnId!)))) throw new MysqlExportError("INCOMPATIBLE_FOREIGN_KEY");
    foreignKeys.push(`ALTER TABLE ${qualified(fk.childDataset)} ADD CONSTRAINT ${nextName(fk.id)} FOREIGN KEY (${fk.pairs.map(pair => quoteMysqlIdentifier(pair.child.target!)).join(", ")}) REFERENCES ${qualified(fk.parentDataset)} (${fk.pairs.map(pair => quoteMysqlIdentifier(pair.parent.target!)).join(", ")});`);
  }
  const content = [...MYSQL_PREAMBLE, ...tables, ...foreignKeys, ""].join("\n\n");
  if (mysqlUtf8(content).length > MYSQL_LIMITS.schemaBytes) throw new MysqlExportError("OVERSIZED");
  assertCurrent();
  const implemented = (finding: DatabaseExportManifest["warnings"][number]) => finding.code !== "TARGET_ADAPTER_NOT_IMPLEMENTED";
  const artifact: MysqlSchemaArtifact = freezeExport({ filename: "datarehearsal-mysql-schema.sql", contentType: "application/sql;charset=utf-8", content, instructions: mysqlInstructions(),
    manifest: { ...plan.manifest, renderer: "MYSQL_SCHEMA_V1", database: options.database, profile: options.profile,
      physicalColumns: columns.map(column => ({ columnId: column.id, type: physical.get(column.id)! })), constraintNames: names, execution: "NOT_EXECUTED", atomicRestore: false,
      warnings: plan.manifest.warnings.filter(implemented), unsupportedFeatures: plan.manifest.unsupportedFeatures.filter(implemented),
      assumptions: [...plan.manifest.assumptions, "MySQL 8.0.30+/8.4 InnoDB, DYNAMIC, >=16 KiB pages, utf8mb4_0900_bin binary NO PAD collation are explicit profile requirements.",
        "DDL implicitly commits; partial tables/data can remain after failure. There is no atomic restore guarantee.",
        "VARCHAR key lengths and conservative row/index limits are checked; no prefix indexes, silent constraint dropping or case-folded duplicate names are accepted.",
        "BOOLEAN is TINYINT with an enforced 0/1 CHECK. Required nonblank/email checks remain application metadata, distinct from NOT NULL."] } });
  ownedSections.set(artifact, { plan, tables: Object.freeze(tables), foreignKeys: Object.freeze(foreignKeys) });
  return artifact;
}
