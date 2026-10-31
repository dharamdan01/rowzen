/**
 * DataRehearsal core v0.1: deterministic in-memory preflight checks.
 * Input is already parsed CSV rows, no network/database reads or writes.
 * Not a complete simulation of PostgreSQL execution semantics.
 * Required fields, duplicate primary keys, basic foreign keys
 */
export type Row = Record<string, string>;
export type ForeignKey = {
  column: string;
  targetDataset: string;
  targetColumn: string;
};
export type Dataset = {
  name: string;
  rows: Row[];
  required?: string[];
  primaryKey?: string;
  foreignKeys?: ForeignKey[];
};
export type Issue = {
  dataset: string;
  rowNumber: number;
  column: string;
  code: 'REQUIRED' | 'DUPLICATE_PK' | 'FK_NOT_FOUND' | 'MISSING_REFERENCE_DATASET' | 'BAD_SCHEMA';
  message: string;
};
export type Report = {
  issues: Issue[];
  totalRows: number;
  invalidRows: number;
  validRows: number;
  blocked: boolean;
};

export function validateDatasets(datasets: Dataset[]): Report {
  const issues: Issue[] = [];
  const byName = new Map<string, Dataset>();
  for (const ds of datasets) {
    if (byName.has(ds.name)) {
      throw new Error(`Duplicate dataset name: ${ds.name}`);
    }
    byName.set(ds.name, ds);
  }

  // Lookup indexes across all datasets. String equality is exact in v0.1.
  const lookup = new Map<string, Set<string>>();
  for (const ds of datasets) {
    const columns = new Set(ds.rows.flatMap(row => Object.keys(row)));
    for (const column of columns) {
      lookup.set(`${ds.name}\u0000${column}`,
        new Set(ds.rows.map(row => (row[column] ?? '').trim()).filter(Boolean)));
    }
  }

  let totalRows = 0;
  const invalidRowKeys = new Set<string>();
  function addIssue(ds: Dataset, index: number, column: string, code: Issue['code'], message: string) {
    issues.push({ dataset: ds.name, rowNumber: index + 2, column, code, message });
    invalidRowKeys.add(`${ds.name}\u0000${index}`);
  }

  for (const ds of datasets) {
    totalRows += ds.rows.length;
    const required = new Set([...(ds.required ?? []), ...(ds.primaryKey ? [ds.primaryKey] : [])]);
    const pkRows = new Map<string, number[]>();
    for (let index = 0; index < ds.rows.length; index++) {
      const row = ds.rows[index];
      for (const column of required) {
        if (!(row[column] ?? '').trim()) {
          addIssue(ds, index, column, 'REQUIRED', `${column} is required`);
        }
      }
      if (ds.primaryKey) {
        const value = (row[ds.primaryKey] ?? '').trim();
        if (value) pkRows.set(value, [...(pkRows.get(value) ?? []), index]);
      }
      for (const fk of ds.foreignKeys ?? []) {
        const value = (row[fk.column] ?? '').trim();
        if (!value) continue; // Nullability is checked separately by required rules.
        if (!byName.has(fk.targetDataset)) {
          addIssue(ds, index, fk.column, 'MISSING_REFERENCE_DATASET',
            `Target dataset ${fk.targetDataset} was not uploaded`);
        } else {
          const target = lookup.get(`${fk.targetDataset}\u0000${fk.targetColumn}`);
          if (!target) {
            addIssue(ds, index, fk.column, 'BAD_SCHEMA',
              `Target column ${fk.targetColumn} is not present in ${fk.targetDataset}`);
          } else if (!target.has(value)) {
            addIssue(ds, index, fk.column, 'FK_NOT_FOUND',
              `Value ${value} not found in ${fk.targetDataset}.${fk.targetColumn}`);
          }
        }
      }
    }
    for (const [value, indices] of pkRows) {
      if (indices.length > 1) {
        for (const index of indices) {
          addIssue(ds, index, ds.primaryKey!, 'DUPLICATE_PK',
            `Primary key ${value} appears ${indices.length} times`);
        }
      }
    }
  }
  return {
    issues,
    totalRows,
    invalidRows: invalidRowKeys.size,
    validRows: totalRows - invalidRowKeys.size,
    blocked: issues.length > 0,
  };
}

/** Returns parents before children. Cycles must be manually resolved. */
export function suggestImportOrder(datasets: Dataset[]): { order: string[]; cycles: string[] } {
  const names = new Set(datasets.map(ds => ds.name));
  const parentsByChild = new Map<string, Set<string>>();
  const childrenByParent = new Map<string, Set<string>>();
  for (const ds of datasets) {
    parentsByChild.set(ds.name, new Set());
    childrenByParent.set(ds.name, new Set());
  }
  for (const ds of datasets) {
    for (const fk of ds.foreignKeys ?? []) {
      if (!names.has(fk.targetDataset)) continue;
      parentsByChild.get(ds.name)!.add(fk.targetDataset);
      childrenByParent.get(fk.targetDataset)!.add(ds.name);
    }
  }
  const ready = datasets.map(ds => ds.name).filter(n => parentsByChild.get(n)!.size === 0);
  const order: string[] = [];
  while (ready.length) {
    const current = ready.shift()!;
    order.push(current);
    for (const child of childrenByParent.get(current)!) {
      const parents = parentsByChild.get(child)!;
      parents.delete(current);
      if (!parents.size) ready.push(child);
    }
  }
  return { order, cycles: datasets.map(ds => ds.name).filter(n => !order.includes(n)) };
}
