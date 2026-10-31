/** Pure metadata projection. No rows, validation runs, AI, browser APIs or persistence. */
import { applyMapping } from "../rehearsal/mapping";
import { buildWorkspaceKeyRules } from "../rehearsal/workspace-config";
import type { FieldType } from "../rehearsal/rules";
import type { IssueCode } from "../rehearsal/types";
import type {
  SchemaColumnDescriptor, SchemaColumnReference, SchemaDatasetDescriptor, SchemaDescriptorIdentity,
  SchemaDescriptorInput, SchemaDiagnostic, SchemaDiagnosticCode, SchemaFieldRuleDescriptor,
  SchemaForeignKeyDescriptor, SchemaKeyDescriptor, WorkspaceSchemaDescriptor,
} from "./types";

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const id = (...parts: unknown[]) => JSON.stringify(parts);
const own = <T>(record: Readonly<Record<string, T>> | undefined, key: string): T | undefined =>
  record && Object.hasOwn(record, key) ? record[key] : undefined;
const fieldTypes: ReadonlySet<string> = new Set<FieldType>(["string", "integer", "number", "boolean", "date", "email"]);
const schemaCodes: ReadonlySet<IssueCode> = new Set(["BAD_SCHEMA", "INCOMPATIBLE_COLUMN_TYPE", "FK_TARGET_NOT_UNIQUE", "MISSING_REFERENCE_DATASET", "UNSUPPORTED_CONSTRAINT"]);

type Diagnose = (code: SchemaDiagnosticCode, subject: string, dataset?: string | null, column?: string | null, preflightCode?: IssueCode) => void;

function describeType(value: FieldType | undefined): Pick<SchemaColumnDescriptor, "configuredType" | "typeLabel"> {
  return value === undefined ? { configuredType: null, typeLabel: "Not configured" }
    : fieldTypes.has(value) ? { configuredType: value, typeLabel: value }
      : { configuredType: null, typeLabel: "Unsupported" };
}

function describeDatasets(input: SchemaDescriptorInput, diagnose: Diagnose): SchemaDatasetDescriptor[] {
  const occurrences = new Map<string, number>();
  const sorted = [...input.datasets].sort((a, b) => compare(a.name, b.name) || compare(id(a.headers), id(b.headers)));
  if (!sorted.length) diagnose("NO_DATASETS", "workspace");
  return sorted.map(dataset => {
    const occurrence = occurrences.get(dataset.name) ?? 0;
    occurrences.set(dataset.name, occurrence + 1);
    const datasetId = id("dataset", dataset.name, occurrence);
    if (!dataset.name.trim()) diagnose("EMPTY_DATASET_NAME", datasetId, dataset.name);
    if (sorted.filter(item => item.name === dataset.name).length > 1) diagnose("DUPLICATE_DATASET", datasetId, dataset.name);
    const headersValid = dataset.headers.length > 0 && dataset.headers.every(header => header.trim()) &&
      new Set(dataset.headers.map(header => header.toLowerCase())).size === dataset.headers.length;
    if (!headersValid) diagnose("INVALID_HEADERS", datasetId, dataset.name);
    const mapping = own(input.mappings, dataset.name);
    let applied = false;
    if (mapping && headersValid) {
      try {
        // Explicitly construct an empty metadata dataset: never spread the caller's CSV object.
        applyMapping({ name: dataset.name, filename: "schema.csv", headers: [...dataset.headers], rows: [], rowNumbers: [] },
          mapping.map(entry => ({ source: entry.source, target: entry.target })));
        applied = true;
      } catch { /* Preserve declarations below; never expose exception text. */ }
    }
    if (!applied) diagnose("INVALID_MAPPING", datasetId, dataset.name);
    const rule = own(input.rules, dataset.name);
    if (!rule) diagnose("MISSING_RULES", datasetId, dataset.name);
    const sources = applied ? mapping!.map(entry => entry.source) : dataset.headers;
    const columnOccurrences = new Map<string, number>();
    const columns = sources.map(source => {
      const count = columnOccurrences.get(source) ?? 0;
      columnOccurrences.set(source, count + 1);
      const entries = mapping?.filter(entry => entry.source === source) ?? [];
      const target = entries.length === 1 ? entries[0].target.trim() || null : null;
      const columnId = id("column", datasetId, source, count);
      return { id: columnId, source, target, ...describeType(target === null ? undefined : own(rule?.types, target)),
        explicitlyRequired: target !== null && Boolean(rule?.required.includes(target)), primaryKeyIds: [], uniqueKeyIds: [] };
    });
    return { id: datasetId, name: dataset.name, mappingStatus: applied ? "APPLIED" : "UNRESOLVED", columns,
      mappings: (mapping ?? []).map(entry => ({ source: entry.source, target: entry.target })) };
  });
}

function referenceResolver(datasets: readonly SchemaDatasetDescriptor[], diagnose: Diagnose) {
  return (dataset: string, target: string | null, subject: string): SchemaColumnReference => {
    const matches = datasets.filter(item => item.name === dataset);
    const entity = matches.length === 1 ? matches[0] : undefined;
    const columns = entity?.columns.filter(column => target !== null && column.target === target) ?? [];
    const state = !entity ? "UNRESOLVED_DATASET" : columns.length > 1 ? "AMBIGUOUS_COLUMN"
      : entity.mappingStatus !== "APPLIED" ? "UNRESOLVED_MAPPING" : !columns.length ? "UNRESOLVED_COLUMN" : "RESOLVED";
    if (state !== "RESOLVED") diagnose(state, subject, dataset, target);
    return { dataset, target, datasetId: entity?.id ?? null, columnId: state === "RESOLVED" ? columns[0].id : null, state };
  };
}
type ResolveReference = ReturnType<typeof referenceResolver>;

function describeFieldRules(input: SchemaDescriptorInput, resolve: ResolveReference, diagnose: Diagnose): SchemaFieldRuleDescriptor[] {
  return Object.keys(input.rules).sort(compare).flatMap(dataset => {
    const rule = input.rules[dataset];
    return [...new Set([...rule.required, ...Object.keys(rule.types)])].sort(compare).map(target => {
      const ruleId = id("field", dataset, target);
      const type = describeType(own(rule.types, target));
      if (type.typeLabel === "Unsupported") diagnose("UNSUPPORTED_TYPE", ruleId, dataset, target);
      return { id: ruleId, column: resolve(dataset, target, ruleId), explicitlyRequired: rule.required.includes(target), ...type };
    });
  });
}

function describeKeys(input: SchemaDescriptorInput, resolve: ResolveReference, diagnose: Diagnose): SchemaKeyDescriptor[] {
  const keys: SchemaKeyDescriptor[] = [];
  const names = new Set([...input.datasets.map(dataset => dataset.name), ...Object.keys(input.rules),
    ...Object.keys(input.primaryOverrides ?? {}), ...Object.keys(input.uniqueSpecs ?? {})]);
  for (const dataset of [...names].sort(compare)) {
    const rule = own(input.rules, dataset);
    const override = own(input.primaryOverrides, dataset) ?? "";
    const uniqueSpec = own(input.uniqueSpecs, dataset) ?? "";
    // Use a fixed internal name so user identifiers cannot become object prototype properties.
    const effective = buildWorkspaceKeyRules({ schema: rule ?? { primaryKey: "", required: [], types: {} } },
      { schema: override }, { schema: uniqueSpec }).schema;
    const primary = effective?.primaryKey ?? (effective === undefined && rule?.primaryKey ? [rule.primaryKey] : undefined);
    const conflict = Boolean(effective?.primaryKey && rule?.primaryKey &&
      !(effective.primaryKey.length === 1 && effective.primaryKey[0] === rule.primaryKey));
    const declarations = [
      ...(primary === undefined ? [] : [{ kind: "PRIMARY" as const, columns: primary, origin: override.trim() ? "WORKSPACE" as const : "LEGACY" as const, effective: Boolean(rule) }]),
      ...(conflict ? [{ kind: "PRIMARY" as const, columns: [rule!.primaryKey], origin: "LEGACY" as const, effective: false }] : []),
      ...(effective?.uniqueKeys ?? []).map(columns => ({ kind: "UNIQUE" as const, columns, origin: "WORKSPACE" as const, effective: Boolean(rule) })),
    ].sort((a, b) => compare(id(a.kind, a.columns, a.origin), id(b.kind, b.columns, b.origin)));
    const occurrences = new Map<string, number>();
    const seenUnique = new Set<string>();
    for (const declaration of declarations) {
      const targets = declaration.columns.map(column => column.trim());
      const signature = id(declaration.kind, targets, declaration.origin);
      const occurrence = occurrences.get(signature) ?? 0;
      occurrences.set(signature, occurrence + 1);
      const keyId = id("key", dataset, signature, occurrence);
      if (!targets.length || targets.some(column => !column) || new Set(targets).size !== targets.length) diagnose("INVALID_KEY", keyId, dataset);
      if (!rule) diagnose("MISSING_RULES", keyId, dataset);
      if (conflict && declaration.kind === "PRIMARY") diagnose("CONFLICTING_PRIMARY_KEY", keyId, dataset);
      const uniqueIdentity = id([...targets].sort(compare));
      if (declaration.kind === "UNIQUE") {
        if (seenUnique.has(uniqueIdentity)) diagnose("DUPLICATE_KEY", keyId, dataset);
        seenUnique.add(uniqueIdentity);
      }
      keys.push({ id: keyId, dataset, kind: declaration.kind, origin: declaration.origin, effective: declaration.effective,
        declaredColumns: [...declaration.columns], columns: targets.map(target => resolve(dataset, target, keyId)) });
    }
  }
  return keys.sort((a, b) => compare(a.id, b.id));
}

function describeForeignKeys(input: SchemaDescriptorInput, resolve: ResolveReference, diagnose: Diagnose): SchemaForeignKeyDescriptor[] {
  const declarations = input.relationships.map(relation => ({ childDataset: relation.childDataset.trim(), parentDataset: relation.parentDataset.trim(),
    declaredChildColumns: "childColumns" in relation ? [...relation.childColumns] : [relation.childColumn],
    declaredParentColumns: "parentColumns" in relation ? [...relation.parentColumns] : [relation.parentColumn] }));
  declarations.sort((a, b) => compare(id(a), id(b)));
  const occurrences = new Map<string, number>();
  return declarations.map(declaration => {
    const child = declaration.declaredChildColumns.map(column => column.trim());
    const parent = declaration.declaredParentColumns.map(column => column.trim());
    const signature = id(declaration.childDataset, child, declaration.parentDataset, parent);
    const occurrence = occurrences.get(signature) ?? 0;
    occurrences.set(signature, occurrence + 1);
    const fkId = id("fk", signature, occurrence);
    if (occurrence) diagnose("DUPLICATE_FOREIGN_KEY", fkId, declaration.childDataset);
    if (!declaration.childDataset || !declaration.parentDataset || !child.length || child.length !== parent.length ||
      [...child, ...parent].some(column => !column) || new Set(child).size !== child.length || new Set(parent).size !== parent.length) {
      diagnose("INVALID_FOREIGN_KEY", fkId, declaration.childDataset);
    }
    const pairs = Array.from({ length: Math.max(child.length, parent.length) }, (_, position) => ({ position,
      child: resolve(declaration.childDataset, child[position] ?? null, fkId), parent: resolve(declaration.parentDataset, parent[position] ?? null, fkId) }));
    // Empty lists still retain dataset-resolution diagnostics.
    if (!pairs.length) { resolve(declaration.childDataset, null, fkId); resolve(declaration.parentDataset, null, fkId); }
    return { id: fkId, ...declaration, pairs };
  });
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Identity comparison only; the owner is responsible for rotating the configuration key. */
export function isSchemaDescriptorCurrent(descriptor: Pick<WorkspaceSchemaDescriptor, "identity">, current: SchemaDescriptorIdentity): boolean {
  return descriptor.identity.sessionId === current.sessionId && descriptor.identity.configurationKey === current.configurationKey;
}

export function buildWorkspaceSchemaDescriptor(input: SchemaDescriptorInput): WorkspaceSchemaDescriptor {
  if (!Number.isSafeInteger(input.identity.sessionId) || input.identity.sessionId < 0 ||
    typeof input.identity.configurationKey !== "string" || !input.identity.configurationKey.trim()) {
    throw new Error("A current schema session and configuration identity are required.");
  }
  const diagnostics = new Map<string, SchemaDiagnostic>();
  const diagnose: Diagnose = (code, subjectId, dataset = null, column = null, preflightCode) => {
    const diagnosticId = id("diagnostic", code, subjectId, dataset, column, preflightCode ?? null);
    diagnostics.set(diagnosticId, { id: diagnosticId, code, subjectId, dataset, column, preflightCode: preflightCode ?? null });
  };
  const datasets = describeDatasets(input, diagnose), resolve = referenceResolver(datasets, diagnose);
  const fieldRules = describeFieldRules(input, resolve, diagnose), keys = describeKeys(input, resolve, diagnose);
  const foreignKeys = describeForeignKeys(input, resolve, diagnose);
  const unresolvedMappings = Object.keys(input.mappings).sort(compare).filter(name => !datasets.some(dataset => dataset.name === name))
    .map(dataset => ({ dataset, mappings: input.mappings[dataset].map(entry => ({ source: entry.source, target: entry.target })) }));
  // Preserve orphan declarations without fabricating a dataset in the diagram.
  for (const dataset of new Set([...Object.keys(input.rules), ...Object.keys(input.mappings),
    ...Object.keys(input.primaryOverrides ?? {}), ...Object.keys(input.uniqueSpecs ?? {})])) {
    if (!datasets.some(item => item.name === dataset)) diagnose("UNRESOLVED_DATASET", id("configuration", dataset), dataset);
  }
  const validation = input.validation;
  const validationCurrent = validation && isSchemaDescriptorCurrent({ identity: validation.identity }, input.identity);
  if (validation && !validationCurrent) diagnose("STALE_REPORT", "workspace");
  if (validationCurrent) for (const issue of validation.report.issues) {
    if (issue.category === "SCHEMA" && schemaCodes.has(issue.code)) {
      diagnose("PREFLIGHT_CONFIGURATION", "workspace", issue.dataset, issue.column, issue.code);
    }
  }
  const validationStatus = validationCurrent ? validation.report.status : "NOT_EVALUATED";
  return freeze({ version: 1, identity: { sessionId: input.identity.sessionId, configurationKey: input.identity.configurationKey },
    configurationState: validationStatus === "CONFIG_ERROR" ? "BLOCKED" : diagnostics.size ? "INCOMPLETE" : "DESCRIBED", validationStatus,
    datasets: datasets.map(dataset => ({ ...dataset, columns: dataset.columns.map(column => ({ ...column,
      primaryKeyIds: keys.filter(key => key.kind === "PRIMARY" && key.effective && key.columns.some(ref => ref.columnId === column.id)).map(key => key.id),
      uniqueKeyIds: keys.filter(key => key.kind === "UNIQUE" && key.effective && key.columns.some(ref => ref.columnId === column.id)).map(key => key.id),
    })) })), unresolvedMappings, fieldRules, keys, foreignKeys, diagnostics: [...diagnostics.values()].sort((a, b) => compare(a.id, b.id)) });
}
