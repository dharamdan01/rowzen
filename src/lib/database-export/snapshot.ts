import type { ParsedCsv } from "../csv/parser";
import type { SchemaDatasetDescriptor } from "../schema-diagram/types";

/** Shared source identity/shape checks, independent of every target's values and NULL rules. */
export function assertExportSnapshot(datasets: readonly ParsedCsv[], metadata: readonly SchemaDatasetDescriptor[],
  limits: { rows: number; cells: number }, fail: (code: "INVALID_SNAPSHOT" | "OVERSIZED") => never) {
  if (datasets.length !== metadata.length || new Set(datasets.map(dataset => dataset.name)).size !== datasets.length) fail("INVALID_SNAPSHOT");
  let rows = 0, cells = 0;
  for (const table of metadata) {
    const dataset = datasets.find(dataset => dataset.name === table.name);
    const sources = new Set(table.columns.map(column => column.source));
    if (!dataset || dataset.headers.length !== sources.size || dataset.headers.some(header => !sources.has(header)) ||
        new Set(dataset.headers).size !== sources.size || dataset.rows.length !== dataset.rowNumbers.length) fail("INVALID_SNAPSHOT");
    rows += dataset.rows.length; cells += dataset.rows.length * table.columns.length;
    if (rows > limits.rows || cells > limits.cells) fail("OVERSIZED");
    let lastLine = 1;
    for (let index = 0; index < dataset.rows.length; index++) {
      const line = dataset.rowNumbers[index], row = dataset.rows[index];
      if (!Number.isSafeInteger(line) || line <= lastLine || !row || Object.keys(row).length !== sources.size ||
          Object.keys(row).some(key => !sources.has(key))) fail("INVALID_SNAPSHOT");
      lastLine = line;
      for (const source of sources) if (!Object.hasOwn(row, source) || typeof row[source] !== "string") fail("INVALID_SNAPSHOT");
    }
  }
  return { rows, cells };
}
