import { assertExportSnapshot } from "./snapshot";
import { freezeExport, type DatabaseExportPlan } from "./types";
import type { createDatabaseExportSession } from "./session";
import { getMongoMetadataScope, type MongoMetadataArtifact } from "./mongodb";
import { encodeMongoCell } from "./mongodb-values";
import { MONGO_EXPORT_LIMITS, MongoExportError } from "./mongodb-contracts";

export interface MongoDocumentArtifact {
  readonly files: readonly { readonly filename: string; readonly collection: string; readonly datasetId: string;
    readonly contentType: "application/x-ndjson;charset=utf-8"; readonly content: string; readonly documents: number }[];
  readonly instructions: string;
  readonly manifest: Omit<MongoMetadataArtifact["manifest"], "containsRecords"> & {
    readonly containsRecords: true; readonly recordEncoding: "EXTENDED_JSON_V2_JSONL";
    readonly records: { readonly totalDocuments: number; readonly totalCells: number;
      readonly conversions: readonly { readonly columnId: string; readonly nulls: number; readonly omitted: number }[];
      readonly limits: typeof MONGO_EXPORT_LIMITS };
    readonly importArguments: readonly { readonly filename: string; readonly collection: string; readonly args: readonly string[] }[];
  };
}

/** Native document adapter: SQL FKs are intentionally never enforced or transformed here. */
export function prepareMongoDocuments(session: ReturnType<typeof createDatabaseExportSession>, plan: DatabaseExportPlan,
  metadata: MongoMetadataArtifact, consent: unknown, assertCurrent: () => void): MongoDocumentArtifact {
  assertCurrent(); const { options } = getMongoMetadataScope(metadata, plan);
  return session.withApprovedRecords(plan, consent, datasets => {
    const tables = plan.manifest.schema.datasets;
    const totals = assertExportSnapshot(datasets, tables, MONGO_EXPORT_LIMITS, code => { throw new MongoExportError(code); });
    const choices = new Map(options.columns.map(column => [column.columnId, column]));
    const conversions = new Map<string, { nulls: number; omitted: number }>();
    let bytes = 0;
    const files = tables.map((table, ordinal) => {
      const collection = options.collections.find(item => item.datasetId === table.id)!;
      const dataset = datasets.find(item => item.name === table.name)!;
      const keyGroups = plan.manifest.schema.keys.filter(key => key.dataset === table.name && key.effective).map(key => key.columns.map(column => column.columnId!));
      const id = table.columns.find(column => column.target === "_id");
      if (id && !keyGroups.some(group => group.length === 1 && group[0] === id.id)) keyGroups.push([id.id]);
      const indexes = keyGroups.map(() => new Set<string>());
      const lines = dataset.rows.map((row, index) => {
        const entries: [string, unknown][] = [], keys = new Map<string, string | null>();
        for (const column of table.columns) {
          const choice = choices.get(column.id)!;
          try {
            const encoded = encodeMongoCell(row[column.source], choice.type, choice.emptyPolicy);
            if (encoded.value !== undefined) entries.push([column.target!, encoded.value]);
            keys.set(column.id, encoded.key);
            if (encoded.value === null || encoded.value === undefined) {
              const counts = conversions.get(column.id) ?? { nulls: 0, omitted: 0 };
              if (encoded.value === null) counts.nulls++; else counts.omitted++;
              conversions.set(column.id, counts);
            }
          } catch (error) {
            if (error instanceof MongoExportError) throw new MongoExportError(error.code, { datasetId: table.id, columnId: column.id, rowNumber: dataset.rowNumbers[index] });
            throw error;
          }
        }
        keyGroups.forEach((group, groupIndex) => {
          // Ordinary Mongo unique indexes include null/missing; they are not SQL NULL-distinct indexes.
          const tuple = JSON.stringify(group.map(id => keys.get(id) ?? null));
          if (indexes[groupIndex].has(tuple)) throw new MongoExportError("DUPLICATE_KEY");
          indexes[groupIndex].add(tuple);
        });
        // Object.fromEntries preserves prototype-like keys as own data without invoking setters.
        const line = JSON.stringify(Object.fromEntries(entries));
        const size = new TextEncoder().encode(line).length;
        bytes += size + 1;
        if (size > MONGO_EXPORT_LIMITS.documentBytes || bytes > MONGO_EXPORT_LIMITS.totalBytes) throw new MongoExportError("OVERSIZED");
        return line;
      });
      return { filename: `datarehearsal-mongodb-${ordinal}.jsonl`, collection: collection.name, datasetId: table.id,
        contentType: "application/x-ndjson;charset=utf-8" as const, content: lines.join("\n") + (lines.length ? "\n" : ""), documents: lines.length };
    });
    assertCurrent();
    return freezeExport({ files, instructions: metadata.instructions,
      manifest: { ...metadata.manifest, containsRecords: true, recordEncoding: "EXTENDED_JSON_V2_JSONL",
        records: { totalDocuments: totals.rows, totalCells: totals.cells,
          conversions: [...conversions].map(([columnId, counts]) => ({ columnId, ...counts })), limits: MONGO_EXPORT_LIMITS },
        importArguments: files.map(file => ({ filename: file.filename, collection: file.collection,
          args: ["--collection", file.collection, "--type", "json", "--file", file.filename, "--mode", "insert", "--stopOnError", "--maintainInsertionOrder"] })) } });
  });
}
