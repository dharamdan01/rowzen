import { assertExportSnapshot } from "./snapshot";
import { analyzeDependencyGraph } from "../rehearsal/graph";
import type { DatabaseExportPlan } from "./types";
import { freezeExport } from "./types";
import type { createDatabaseExportSession } from "./session";
import { getPostgresSchemaSections, quotePostgresIdentifier, type PostgresSchemaArtifact } from "./postgresql";
import { encodePostgresDataCell, POSTGRES_DATA_LIMITS, PostgresDataError } from "./postgresql-values";

export interface PostgresDataArtifact {
  readonly filename: "datarehearsal-postgresql-restore.sql";
  readonly contentType: "application/sql;charset=utf-8";
  readonly content: string;
  readonly instructions: string;
  readonly manifest: Omit<PostgresSchemaArtifact["manifest"], "mode" | "containsRecords" | "renderer" | "policy" | "assumptions"> & {
    readonly mode: "SCHEMA_AND_RECORDS";
    readonly containsRecords: true;
    readonly renderer: "POSTGRESQL_RESTORE_V1";
    readonly policy: Omit<PostgresSchemaArtifact["manifest"]["policy"], "dataEncoding"> & { readonly dataEncoding: "UTF8_HEX_INSERTS" };
    readonly assumptions: readonly string[];
    readonly records: {
      readonly totalRows: number;
      readonly totalCells: number;
      readonly importOrder: readonly string[];
      readonly cycleGroups: readonly (readonly string[])[];
      readonly nullConversions: readonly { readonly columnId: string; readonly count: number }[];
      readonly verification: "LOCAL_VALUE_AND_KEY_CHECKS_ONLY";
      readonly loadPolicy: "CREATE_KEYS_LOAD_THEN_ADD_FOREIGN_KEYS";
      readonly limits: typeof POSTGRES_DATA_LIMITS;
    };
  };
}

/** The session supplies only its own current approved snapshot, after consent and report checks. */
export function preparePostgresDataExport(session: ReturnType<typeof createDatabaseExportSession>, plan: DatabaseExportPlan,
  schema: PostgresSchemaArtifact, consent: unknown, assertCurrent: () => void): PostgresDataArtifact {
  assertCurrent();
  const sections = getPostgresSchemaSections(schema, plan);
  return session.withApprovedRecords(plan, consent, datasets => {
    const totals = assertExportSnapshot(datasets, plan.manifest.schema.datasets, POSTGRES_DATA_LIMITS, code => { throw new PostgresDataError(code); });
    const tables = plan.manifest.schema.datasets;
    const types = new Map(schema.manifest.physicalColumns.map(column => [column.columnId, column.type]));
    const policies = new Map(plan.manifest.choices.map(column => [column.columnId, column.emptyPolicy]));
    const encoded = new Map<string, ReturnType<typeof encodePostgresDataCell>[][]>();
    const conversions = new Map<string, number>();
    let encodedBytes = 0;
    for (const table of tables) {
      const dataset = datasets.find(dataset => dataset.name === table.name)!;
      encoded.set(table.name, dataset.rows.map((row, index) => table.columns.map(column => {
        try {
          const cell = encodePostgresDataCell(row[column.source], types.get(column.id)!, policies.get(column.id)!);
          encodedBytes += cell.sql.length + 2;
          if (encodedBytes > POSTGRES_DATA_LIMITS.sqlBytes) throw new PostgresDataError("OVERSIZED");
          if (cell.convertedNull) conversions.set(column.id, (conversions.get(column.id) ?? 0) + 1);
          return cell;
        } catch (error) {
          if (error instanceof PostgresDataError) throw new PostgresDataError(error.code, { datasetId: table.id, rowNumber: dataset.rowNumbers[index], columnId: column.id });
          throw error;
        }
      })));
    }
    const tuple = (dataset: string, row: ReturnType<typeof encodePostgresDataCell>[], columnIds: readonly (string | null)[]) => {
      const table = tables.find(table => table.name === dataset)!;
      const values = columnIds.map(id => row[table.columns.findIndex(column => column.id === id)].key);
      return values.includes(null) ? null : JSON.stringify(values);
    };
    // Target-value equality after approved casts; no CSV trim/blank-skipping policy is reused here.
    for (const key of plan.manifest.schema.keys.filter(key => key.effective)) {
      const seen = new Set<string>();
      for (const row of encoded.get(key.dataset)!) {
        const value = tuple(key.dataset, row, key.columns.map(column => column.columnId));
        if (value === null) continue;
        if (seen.has(value)) throw new PostgresDataError("DUPLICATE_KEY");
        seen.add(value);
      }
    }
    for (const fk of plan.manifest.schema.foreignKeys) {
      const parents = new Set(encoded.get(fk.parentDataset)!.map(row => tuple(fk.parentDataset, row, fk.pairs.map(pair => pair.parent.columnId))).filter(value => value !== null));
      for (const row of encoded.get(fk.childDataset)!) {
        const value = tuple(fk.childDataset, row, fk.pairs.map(pair => pair.child.columnId));
        if (value !== null && !parents.has(value)) throw new PostgresDataError("FOREIGN_KEY_NOT_FOUND");
      }
    }
    const graph = analyzeDependencyGraph(tables.map(table => table.name), plan.manifest.schema.foreignKeys.map(fk => ({
      childDataset: fk.childDataset, childColumns: fk.pairs.map(pair => pair.child.target!), parentDataset: fk.parentDataset, parentColumns: fk.pairs.map(pair => pair.parent.target!),
    })));
    const importOrder = [...graph.importOrder, ...tables.map(table => table.name).filter(name => !graph.importOrder.includes(name)).sort()];
    const statements: string[] = ["-- Rowzen: sensitive approved records encoded as UTF-8 hex. Hex is reversible, not encryption.",
      "-- New tables only. Review SQL, manifest and instructions. No database execution has occurred.", "BEGIN;", ...sections.tables];
    let bytes = new TextEncoder().encode(statements.join("\n\n")).length;
    for (const name of importOrder) {
      const table = tables.find(table => table.name === name)!;
      const target = `${quotePostgresIdentifier(schema.manifest.namespace)}.${quotePostgresIdentifier(name)}`;
      const columns = table.columns.map(column => quotePostgresIdentifier(column.target!)).join(", ");
      for (const row of encoded.get(name)!) {
        const statement = `INSERT INTO ${target} (${columns}) VALUES (${row.map(cell => cell.sql).join(", ")});`;
        bytes += new TextEncoder().encode(statement).length + 2;
        if (bytes > POSTGRES_DATA_LIMITS.sqlBytes) throw new PostgresDataError("OVERSIZED");
        statements.push(statement);
      }
    }
    statements.push(...sections.foreignKeys, "COMMIT;", "");
    const content = statements.join("\n\n");
    if (new TextEncoder().encode(content).length > POSTGRES_DATA_LIMITS.sqlBytes) throw new PostgresDataError("OVERSIZED");
    assertCurrent();
    return freezeExport({ filename: "datarehearsal-postgresql-restore.sql", contentType: "application/sql;charset=utf-8", content,
      instructions: ["SENSITIVE RECORD EXPORT: hexadecimal strings are reversible, not encrypted. Store and share accordingly.",
        "This file includes new table creation AND approved current records. Do not run the schema-only file first.",
        "Review the manifest, physical types, namespace, NULL choices and full script. Create the reviewed destination schema separately.",
        "First test on a disposable PostgreSQL database. Nothing in Rowzen connects to or executes against your database.",
        "Use a UTF-8 PostgreSQL database. With your own reviewed connection settings, run: psql --set=ON_ERROR_STOP=1 --file=datarehearsal-postgresql-restore.sql",
        "The script uses a transaction. On any error stop and ROLLBACK; do not continue or retry against existing tables.",
        "All keys are created first; parent-first order is used where possible, with cyclic components loaded before FK addition.",
        "FK addition validates all records before COMMIT. No constraint is disabled and no row is silently skipped.",
        "Missing cells are rejected; literal NULL/null/\\N strings remain text. Only exact empty strings convert to SQL NULL when explicitly selected.",
        "Numeric casts are explicit. No integer precision loss or decimal rounding is allowed. DOUBLE PRECISION records are unsupported; choose NUMERIC or text.",
        "The browser snapshot is parsed CSV, not original CSV bytes: original quoting and previously skipped all-empty records cannot be reconstructed.",
        "Target collation, locale, existing objects, triggers, extensions and permissions remain unverified. CSV preflight is not a database import guarantee.",
        "Limits: 100000 rows, 250000 cells, 1 MiB per value, 32 MiB SQL; dates 0001-9999, strict decimal notation only.", ""].join("\n"),
      manifest: { ...schema.manifest, mode: "SCHEMA_AND_RECORDS", containsRecords: true, renderer: "POSTGRESQL_RESTORE_V1",
        policy: { ...schema.manifest.policy, dataEncoding: "UTF8_HEX_INSERTS" },
        assumptions: [...schema.manifest.assumptions.filter(text => !text.includes("cycles are supported for empty schema creation only") && !text.startsWith("No existing schema/table migration, data compatibility, NULL conversion")),
          "Values were checked locally, not imported into the user's database. Target collation and environment remain unverified.",
          "Only canonical dependency-cycle blockers are accepted; all blocking DATA or SCHEMA findings refuse record export.",
          "Data is current approved parsed CSV; no original/history values, trimming, formula protection, implicit NULL tokens or automatic repairs are exported."],
        records: { totalRows: totals.rows, totalCells: totals.cells, importOrder, cycleGroups: graph.cycleGroups,
          nullConversions: [...conversions].map(([columnId, count]) => ({ columnId, count })), verification: "LOCAL_VALUE_AND_KEY_CHECKS_ONLY", loadPolicy: "CREATE_KEYS_LOAD_THEN_ADD_FOREIGN_KEYS", limits: POSTGRES_DATA_LIMITS } },
    });
  });
}
