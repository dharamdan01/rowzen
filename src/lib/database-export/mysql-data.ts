import { analyzeDependencyGraph } from "../rehearsal/graph";
import type { createDatabaseExportSession } from "./session";
import { assertExportSnapshot } from "./snapshot";
import { freezeExport, type DatabaseExportPlan } from "./types";
import { MYSQL_LIMITS, MysqlExportError } from "./mysql-contracts";
import { encodeMysqlCell, mysqlUtf8 } from "./mysql-values";
import { getMysqlSections, MYSQL_PREAMBLE, mysqlInstructions, quoteMysqlIdentifier, type MysqlSchemaArtifact } from "./mysql";

export interface MysqlDataArtifact {
  readonly filename: "datarehearsal-mysql-restore.sql";
  readonly contentType: "application/sql;charset=utf-8";
  readonly content: string;
  readonly instructions: string;
  readonly manifest: Omit<MysqlSchemaArtifact["manifest"], "mode" | "containsRecords" | "renderer" | "policy"> & {
    readonly mode: "SCHEMA_AND_RECORDS"; readonly containsRecords: true; readonly renderer: "MYSQL_RESTORE_V1";
    readonly policy: Omit<MysqlSchemaArtifact["manifest"]["policy"], "dataEncoding"> & { readonly dataEncoding: "MYSQL_UTF8_HEX_INSERTS" };
    readonly records: { readonly totalRows: number; readonly totalCells: number; readonly importOrder: readonly string[];
      readonly cycleGroups: readonly (readonly string[])[]; readonly nullConversions: readonly { columnId: string; count: number }[];
      readonly verification: "LOCAL_VALUE_AND_KEY_CHECKS_ONLY"; readonly limits: typeof MYSQL_LIMITS };
  };
}
export function prepareMysqlDataExport(session: ReturnType<typeof createDatabaseExportSession>, plan: DatabaseExportPlan,
  schema: MysqlSchemaArtifact, consent: unknown, assertCurrent: () => void): MysqlDataArtifact {
  assertCurrent(); const sections = getMysqlSections(schema, plan);
  return session.withApprovedRecords(plan, consent, datasets => {
    const totals = assertExportSnapshot(datasets, plan.manifest.schema.datasets, MYSQL_LIMITS, code => { throw new MysqlExportError(code); });
    const tables = plan.manifest.schema.datasets;
    const types = new Map(schema.manifest.physicalColumns.map(column => [column.columnId, column.type]));
    const policies = new Map(plan.manifest.choices.map(column => [column.columnId, column.emptyPolicy]));
    const encoded = new Map<string, ReturnType<typeof encodeMysqlCell>[][]>(), conversions = new Map<string, number>();
    let bytes = 0;
    for (const table of tables) {
      const dataset = datasets.find(dataset => dataset.name === table.name)!;
      encoded.set(table.name, dataset.rows.map((row, index) => table.columns.map(column => {
        try {
          const cell = encodeMysqlCell(row[column.source], types.get(column.id)!, policies.get(column.id)!);
          bytes += cell.sql.length + 2;
          if (bytes > MYSQL_LIMITS.sqlBytes) throw new MysqlExportError("OVERSIZED");
          if (cell.convertedNull) conversions.set(column.id, (conversions.get(column.id) ?? 0) + 1);
          return cell;
        } catch (error) {
          if (error instanceof MysqlExportError) throw new MysqlExportError(error.code, { datasetId: table.id, columnId: column.id, rowNumber: dataset.rowNumbers[index] });
          throw error;
        }
      })));
    }
    const tuple = (name: string, row: ReturnType<typeof encodeMysqlCell>[], columnIds: readonly (string | null)[]) => {
      const table = tables.find(table => table.name === name)!;
      const values = columnIds.map(id => row[table.columns.findIndex(column => column.id === id)].key);
      return values.includes(null) ? null : JSON.stringify(values);
    };
    for (const key of plan.manifest.schema.keys.filter(key => key.effective)) {
      const seen = new Set<string>();
      for (const row of encoded.get(key.dataset)!) {
        const value = tuple(key.dataset, row, key.columns.map(column => column.columnId));
        if (value === null) continue;
        if (seen.has(value)) throw new MysqlExportError("DUPLICATE_KEY");
        seen.add(value);
      }
    }
    for (const fk of plan.manifest.schema.foreignKeys) {
      const parents = new Set(encoded.get(fk.parentDataset)!.map(row => tuple(fk.parentDataset, row, fk.pairs.map(pair => pair.parent.columnId))).filter(value => value !== null));
      for (const row of encoded.get(fk.childDataset)!) {
        const value = tuple(fk.childDataset, row, fk.pairs.map(pair => pair.child.columnId));
        if (value !== null && !parents.has(value)) throw new MysqlExportError("FOREIGN_KEY_NOT_FOUND");
      }
    }
    const graph = analyzeDependencyGraph(tables.map(table => table.name), plan.manifest.schema.foreignKeys.map(fk => ({ childDataset: fk.childDataset,
      childColumns: fk.pairs.map(pair => pair.child.target!), parentDataset: fk.parentDataset, parentColumns: fk.pairs.map(pair => pair.parent.target!) })));
    const importOrder = [...graph.importOrder, ...tables.map(table => table.name).filter(name => !graph.importOrder.includes(name)).sort()];
    const statements = ["-- SENSITIVE corrected records: hex is reversible, not encryption. No database execution has occurred.", ...MYSQL_PREAMBLE, ...sections.tables, "START TRANSACTION;"];
    bytes = mysqlUtf8(statements.join("\n\n")).length;
    for (const name of importOrder) {
      const table = tables.find(table => table.name === name)!;
      const target = `${quoteMysqlIdentifier(schema.manifest.database)}.${quoteMysqlIdentifier(name)}`;
      for (const row of encoded.get(name)!) {
        const sql = `INSERT INTO ${target} (${table.columns.map(column => quoteMysqlIdentifier(column.target!)).join(", ")}) VALUES (${row.map(cell => cell.sql).join(", ")});`;
        bytes += mysqlUtf8(sql).length + 2;
        if (bytes > MYSQL_LIMITS.sqlBytes) throw new MysqlExportError("OVERSIZED");
        statements.push(sql);
      }
    }
    statements.push("COMMIT;", ...sections.foreignKeys, "");
    const content = statements.join("\n\n");
    if (mysqlUtf8(content).length > MYSQL_LIMITS.sqlBytes) throw new MysqlExportError("OVERSIZED");
    assertCurrent();
    return freezeExport({ filename: "datarehearsal-mysql-restore.sql", contentType: "application/sql;charset=utf-8", content, instructions: mysqlInstructions(true),
      manifest: { ...schema.manifest, mode: "SCHEMA_AND_RECORDS", containsRecords: true, renderer: "MYSQL_RESTORE_V1",
        policy: { ...schema.manifest.policy, dataEncoding: "MYSQL_UTF8_HEX_INSERTS" },
        records: { totalRows: totals.rows, totalCells: totals.cells, importOrder, cycleGroups: graph.cycleGroups,
          nullConversions: [...conversions].map(([columnId, count]) => ({ columnId, count })), verification: "LOCAL_VALUE_AND_KEY_CHECKS_ONLY", limits: MYSQL_LIMITS } } });
  });
}
