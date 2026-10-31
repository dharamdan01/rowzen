import { z } from "zod";
import { applyMapping } from "../rehearsal/mapping";
import { templateConfigurationSchema, type TemplateConfiguration } from "../templates/schema";
import { checkTemplateCompatibility } from "../templates/workspace";
import { AiError, aiVersionSchema, type AiVersion } from "./contracts";
import { profileColumn, profileDiagnostics, profileEvidence, type ColumnProfile, type ProfileDataset } from "./column-profile";
import { buildWorkspaceKeyRules } from "../rehearsal/workspace-config";
import type { FieldType } from "../rehearsal/rules";

const fieldType = templateConfigurationSchema.shape.rules.valueType.shape.types.valueType;
const sourceId = z.string().regex(/^c\d{1,2}$/);
const targetId = z.string().regex(/^t\d{1,2}$/);
const wireSettings = {
  type: z.enum(["unsure", "string", "integer", "number", "boolean", "date", "email"]),
  required: z.enum(["unsure", "yes", "no"]), key: z.enum(["none", "primary", "unique"]),
};
export const schemaSuggestionSchema = z.object({
  sourceId, targetId: targetId.nullable(), type: fieldType.nullable(), required: z.boolean().nullable(),
  key: z.enum(["primary", "unique"]).nullable(),
  reason: z.enum(["template_match", "name_hint", "ambiguous", "insufficient_evidence"]),
}).strict();
export const schemaMappingResponseSchema = z.object({
  schemaVersion: z.literal(1), suggestions: z.array(schemaSuggestionSchema).max(16),
}).strict();
export type SchemaMappingResponse = z.infer<typeof schemaMappingResponseSchema>;
export type SchemaSuggestion = z.infer<typeof schemaSuggestionSchema>;
export const schemaMappingWireResponseSchema = z.object({
  schemaVersion: z.literal(1), suggestions: z.array(schemaSuggestionSchema.extend(wireSettings)).max(16),
}).strict();
export const schemaReasonText = {
  template_match: "Possible match to the selected template; confirm that the meaning is the same.",
  name_hint: "A name-based mapping hypothesis; local value checks must also support proposed settings.",
  ambiguous: "The column name is ambiguous. Check the intended meaning before accepting.",
  insufficient_evidence: "Not enough schema evidence to recommend a change.",
} satisfies Record<SchemaSuggestion["reason"], string>;

type Column = { id: string; name: string; currentTarget: string; type: FieldType | null; required: boolean; primary: boolean; profile: ColumnProfile | null; allowedTargets: string[]; allowedKeys: ("primary" | "unique")[]; relationshipCount: number };
type Target = { id: string; name: string; template: boolean; type: string | null; required: boolean | null; primary: boolean | null };
export type SchemaDrift = {
  status: "no_template" | "dataset_missing" | "compared";
  compatibility: { ok: true } | { ok: false; reason: string } | null;
  added: string[]; removed: string[]; reordered: boolean;
  incompatible: { column: string; current: string; previous: string }[];
};
declare const schemaContextBrand: unique symbol;
export type SchemaMappingContext = Readonly<{ version: AiVersion; [schemaContextBrand]: true }>;
type Entry = {
  json: string; configuration: TemplateConfiguration; datasetName: string;
  columns: Column[]; targets: Target[]; drift: SchemaDrift; templateHeaders: Map<string, string>;
};
const contexts = new WeakMap<object, Entry>();

/** Structural comparison only. No rows, type inference from values, or invented baseline. */
export function compareSchemaTemplate(configuration: TemplateConfiguration, datasetName: string, template: TemplateConfiguration | null): SchemaDrift {
  const empty = { added: [], removed: [], reordered: false, incompatible: [] };
  if (!template) return { ...empty, status: "no_template", compatibility: null };
  const current = configuration.datasets.find(dataset => dataset.name === datasetName);
  const previous = template.datasets.find(dataset => dataset.name === datasetName);
  const compatibility = checkTemplateCompatibility(template, configuration.datasets);
  if (!current || !previous) return { ...empty, status: "dataset_missing", compatibility };
  const currentSet = new Set(current.headers), previousSet = new Set(previous.headers);
  const currentMapping = new Map(configuration.mappings[datasetName].map(entry => [entry.source, entry.target]));
  const previousMapping = new Map(template.mappings[datasetName].map(entry => [entry.source, entry.target]));
  return {
    status: "compared", compatibility,
    added: current.headers.filter(header => !previousSet.has(header)),
    removed: previous.headers.filter(header => !currentSet.has(header)),
    reordered: current.headers.length === previous.headers.length && current.headers.every(header => previousSet.has(header)) && current.headers.some((header, index) => header !== previous.headers[index]),
    incompatible: current.headers.flatMap(column => {
      const current = configuration.rules[datasetName].types[currentMapping.get(column)!];
      const previous = template.rules[datasetName].types[previousMapping.get(column)!];
      return current && previous && current !== previous ? [{ column, current, previous }] : [];
    }),
  };
}

/** Explicit privacy extension: opted-in labels and configured rules, never ParsedCsv/rows. */
export function buildSchemaMappingContext(input: { configuration: TemplateConfiguration; datasetName: string; template: TemplateConfiguration | null; version: AiVersion; dataset?: ProfileDataset }): SchemaMappingContext {
  try {
    const configuration = templateConfigurationSchema.parse(input.configuration);
    const template = input.template ? templateConfigurationSchema.parse(input.template) : null;
    const version = Object.freeze(aiVersionSchema.parse(input.version));
    const dataset = configuration.datasets.find(dataset => dataset.name === input.datasetName);
    const previous = template?.datasets.find(dataset => dataset.name === input.datasetName);
    if (!dataset) throw new AiError("INVALID_CONTEXT");
    if (input.dataset && (input.dataset.name !== dataset.name || input.dataset.headers.length !== dataset.headers.length || dataset.headers.some((header, index) => header !== input.dataset!.headers[index]))) throw new AiError("INVALID_CONTEXT");
    if (dataset.headers.length > 16 || (previous?.headers.length ?? 0) > 16) throw new AiError("CONTEXT_TOO_LARGE");
    const rules = configuration.rules[dataset.name];
    const targets: Target[] = [];
    const addTarget = (name: string) => {
      if (!name || name.length > 128 || targets.some(target => target.name === name)) return;
      const templateMapping = previous && template!.mappings[dataset.name].find(entry => entry.target === name);
      const templateRules = templateMapping ? template!.rules[dataset.name] : null;
      targets.push({ id: `t${targets.length}`, name, template: Boolean(templateMapping), type: templateRules?.types[name] ?? null,
        required: templateRules ? templateRules.required.includes(name) : null, primary: templateRules ? templateRules.primaryKey === name : null });
    };
    configuration.mappings[dataset.name].forEach(entry => addTarget(entry.target));
    if (previous) template!.mappings[dataset.name].forEach(entry => addTarget(entry.target));
    dataset.headers.forEach(header => addTarget(header.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "")));
    const currentKeys = buildWorkspaceKeyRules(configuration.rules, configuration.primaryOverrides, configuration.uniqueSpecs);
    const previousKeys = template && buildWorkspaceKeyRules(template.rules, template.primaryOverrides, template.uniqueSpecs);
    const columns: Column[] = configuration.mappings[dataset.name].map((entry, index) => {
      const previousMapping = previous && template!.mappings[dataset.name].find(mapping => mapping.source === entry.source);
      const previousType = previousMapping ? template!.rules[dataset.name].types[previousMapping.target] : undefined;
      const profile = input.dataset ? profileColumn(input.dataset, entry.source, {
        labels: [entry.target, ...(previousMapping ? [previousMapping.target] : [])],
        types: [rules.types[entry.target], previousType].filter((type): type is FieldType => type !== undefined),
      }) : null;
      const allowedTargets = targets.filter(target => {
        const normalizedSource = compactLabel(entry.source);
        if (target.name === entry.target || (normalizedSource && compactLabel(target.name) === normalizedSource)) return true;
        if (!profile || !previous || !target.template) return false;
        const prior = template!.mappings[dataset.name].find(mapping => mapping.target === target.name)!;
        const semanticMatch = prior.source === entry.source || relatedLabels(prior.source, entry.source);
        return semanticMatch && (!target.type || profile.compatibleTypes.includes(target.type as FieldType));
      }).map(target => target.id);
      const keyEvidence = profile && profile.nonEmpty > 0 && !profile.empty && !profile.duplicateRows;
      const existing = currentKeys[dataset.name];
      const primary = existing?.primaryKey ?? (rules.primaryKey ? [rules.primaryKey] : []);
      const priorKeys = previousKeys?.[dataset.name];
      const priorPrimary = priorKeys?.primaryKey ?? (template?.rules[dataset.name]?.primaryKey ? [template.rules[dataset.name].primaryKey] : []);
      const identifier = /^(id|uuid|key)$/.test(compactLabel(entry.source));
      const canPrimary = identifier || (primary.length === 1 && primary[0] === entry.target) || (previousMapping && priorPrimary.length === 1 && priorPrimary[0] === previousMapping.target);
      const canUnique = canPrimary || (profile?.inferredType === "email" && /email/.test(compactLabel(entry.source))) ||
        existing?.uniqueKeys?.some(columns => columns.length === 1 && columns[0] === entry.target) ||
        (previousMapping && priorKeys?.uniqueKeys?.some(columns => columns.length === 1 && columns[0] === previousMapping.target));
      return {
      id: `c${index}`, name: entry.source, currentTarget: targets.find(target => target.name === entry.target)!.id,
      type: rules.types[entry.target] ?? null, required: rules.required.includes(entry.target), primary: primary.length === 1 && primary[0] === entry.target,
      profile, allowedTargets, allowedKeys: keyEvidence ? [...(canPrimary ? ["primary" as const] : []), ...(canUnique ? ["unique" as const] : [])] : [],
      relationshipCount: [...configuration.relationships, ...configuration.compositeRelationships].filter(relationship => relationship.childDataset === dataset.name &&
        ("childColumns" in relationship ? relationship.childColumns.includes(entry.target) : relationship.childColumn === entry.target)).length,
    }; });
    // Dataset/project/template names, identifiers, descriptions and arbitrary object properties are omitted.
    const json = JSON.stringify({ schemaVersion: 1, columns: columns.map(column => ({ id: column.id, name: column.name, currentTarget: column.currentTarget,
      configuredType: column.type, configuredRequired: column.required, configuredPrimary: column.primary,
      allowedTargets: column.allowedTargets, allowedKeys: column.allowedKeys,
      profile: column.profile && { inferredType: column.profile.inferredType, nonEmpty: column.profile.nonEmpty, empty: column.profile.empty,
        duplicateRows: column.profile.duplicateRows, leadingZeros: column.profile.leadingZeros, unsafeIntegers: column.profile.unsafeIntegers,
        formatHints: Object.fromEntries((["email", "date"] as const).filter(type => column.profile!.formats[type].like).map(type => [type, { valid: column.profile!.formats[type].valid, invalid: column.profile!.formats[type].invalid }])),
      },
    })), targets, baselineAvailable: Boolean(previous),
      previousColumns: previous?.headers ?? [] });
    if (new TextEncoder().encode(json).byteLength > 6144) throw new AiError("CONTEXT_TOO_LARGE");
    const context = Object.freeze({ version }) as SchemaMappingContext;
    contexts.set(context, { json, configuration, datasetName: dataset.name, columns, targets,
      drift: compareSchemaTemplate(configuration, dataset.name, template),
      templateHeaders: new Map(previous ? template!.mappings[dataset.name].map(entry => [entry.target, entry.source]) : []) });
    return context;
  } catch (error) { throw error instanceof AiError ? error : new AiError("INVALID_CONTEXT"); }
}
function compactLabel(label: string): string { return label.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""); }
function relatedLabels(a: string, b: string): boolean {
  const core = (label: string) => label.normalize("NFKC").replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(token => token && !["full", "display", "address"].includes(token)).join("");
  return Boolean(core(a)) && core(a) === core(b);
}
function entryFor(context: SchemaMappingContext): Entry {
  const entry = contexts.get(context);
  if (!entry) throw new AiError("INVALID_CONTEXT");
  return entry;
}
function supportedTypes(column: Column, target: Target): FieldType[] {
  const profile = column.profile;
  if (!profile?.nonEmpty) return [];
  const permitted = new Set<FieldType>();
  // Inference never silently broadens a declared type just to make invalid records pass.
  if (column.type) { if (profile.compatibleTypes.includes(column.type)) permitted.add(column.type); }
  else if (profile.inferredType) permitted.add(profile.inferredType);
  if (target.template && target.type && profile.compatibleTypes.includes(target.type as FieldType)) permitted.add(target.type as FieldType);
  return [...permitted];
}
function supportedRequired(column: Column, target: Target): boolean[] {
  const permitted: boolean[] = [];
  if (!column.required || (target.template && target.required === false)) permitted.push(false);
  if (column.profile?.nonEmpty && !column.profile.empty && (column.required || (target.template && target.required))) permitted.push(true);
  return permitted;
}
function checkSemanticEvidence(entry: Entry, suggestion: SchemaSuggestion): void {
  const column = entry.columns.find(column => column.id === suggestion.sourceId)!;
  const target = entry.targets.find(target => target.id === (suggestion.targetId ?? column.currentTarget))!;
  if (!column.allowedTargets.includes(target.id) ||
      (suggestion.type !== null && !supportedTypes(column, target).includes(suggestion.type)) ||
      (suggestion.key !== null && !column.allowedKeys.includes(suggestion.key)) ||
      (suggestion.required !== null && !supportedRequired(column, target).includes(suggestion.required))) {
    throw new AiError("INCOMPATIBLE_SUGGESTION");
  }
}
export function serializeSchemaMappingContext(context: SchemaMappingContext): string { return entryFor(context).json; }
/** Keep each source's choices bounded; unsupported template reasons are excluded at generation. */
export function schemaMappingOutputFormat(context: SchemaMappingContext) {
  const entry = entryFor(context);
  const branches = entry.columns.map(column => {
    const targets = entry.targets.filter(target => column.allowedTargets.includes(target.id));
    const types = new Set(targets.flatMap(target => supportedTypes(column, target)));
    const required = new Set(targets.flatMap(target => supportedRequired(column, target)));
    return schemaSuggestionSchema.extend({
      sourceId: z.literal(column.id), targetId: z.enum(column.allowedTargets as [string, ...string[]]).nullable(),
      type: z.enum(["unsure", ...types]), required: z.enum(["unsure", ...(required.has(true) ? ["yes" as const] : []), ...(required.has(false) ? ["no" as const] : [])]),
      key: z.enum(["none", ...column.allowedKeys]),
      // A mixed set can include the unchanged, non-template target. Do not let a reason
      // claim evidence that is only true for a different possible target.
      reason: z.enum(["name_hint", "ambiguous", "insufficient_evidence", ...(targets.every(target => target.template) ? ["template_match" as const] : [])]),
    });
  });
  return z.toJSONSchema(z.object({ schemaVersion: z.literal(1), suggestions: z.array(z.union(branches)).max(entry.columns.length) }).strict());
}
function schemaResponseError(issues: readonly { code: string; path: readonly PropertyKey[] }[]): AiError {
  const invalidId = issues.some(issue => issue.code === "invalid_format" && ["sourceId", "targetId"].includes(String(issue.path[issue.path.length - 1])));
  return new AiError("INVALID_RESPONSE", invalidId ? "UNKNOWN_REFERENCE" : "OUTPUT_SCHEMA");
}
export function decodeSchemaMappingResponse(context: SchemaMappingContext, value: unknown): SchemaMappingResponse {
  const wire = schemaMappingWireResponseSchema.safeParse(value);
  if (!wire.success) throw schemaResponseError(wire.error.issues);
  return validateSchemaMappingResponse(context, { schemaVersion: 1, suggestions: wire.data.suggestions.map(suggestion => ({ ...suggestion,
    type: suggestion.type === "unsure" ? null : suggestion.type,
    required: suggestion.required === "unsure" ? null : suggestion.required === "yes",
    key: suggestion.key === "none" ? null : suggestion.key,
  })) });
}
export function validateSchemaMappingResponse(context: SchemaMappingContext, value: unknown): SchemaMappingResponse {
  const entry = entryFor(context), parsed = schemaMappingResponseSchema.safeParse(value);
  if (!parsed.success) throw schemaResponseError(parsed.error.issues);
  const seen = new Set<string>(), targets = new Set<string>();
  for (const [index, suggestion] of parsed.data.suggestions.entries()) {
    const target = entry.targets.find(target => target.id === suggestion.targetId);
    if (!entry.columns.some(column => column.id === suggestion.sourceId) || (suggestion.targetId !== null && !target)) throw new AiError("INVALID_RESPONSE", "UNKNOWN_REFERENCE");
    if (seen.has(suggestion.sourceId) || (suggestion.targetId !== null && targets.has(suggestion.targetId))) throw new AiError("INVALID_RESPONSE", "DUPLICATE_REFERENCE");
    if (suggestion.reason === "template_match" && !target?.template) throw new AiError("INVALID_RESPONSE", "TEMPLATE_EVIDENCE");
    seen.add(suggestion.sourceId); if (suggestion.targetId) targets.add(suggestion.targetId);
    // A stated abstention wins over contradictory proposed fields. It can never become actionable.
    const checked = ["ambiguous", "insufficient_evidence"].includes(suggestion.reason)
      ? { ...suggestion, targetId: null, type: null, required: null, key: null } : suggestion;
    checkSemanticEvidence(entry, checked);
    parsed.data.suggestions[index] = checked;
  }
  // The session/UI never retains a mutable provider-owned response.
  return structuredClone(parsed.data);
}
export function schemaMappingDetails(context: SchemaMappingContext) {
  const entry = entryFor(context);
  return structuredClone({ columns: entry.columns, targets: entry.targets, drift: entry.drift });
}
/** Only effective setting changes belong in the approval UI; unchanged fields are evidence. */
export function schemaSuggestionChanges(context: SchemaMappingContext, suggestion: SchemaSuggestion): string[] {
  const entry = entryFor(context), column = entry.columns.find(column => column.id === suggestion.sourceId)!;
  const target = entry.targets.find(target => target.id === (suggestion.targetId ?? column.currentTarget))!;
  const keys = buildWorkspaceKeyRules(entry.configuration.rules, entry.configuration.primaryOverrides, entry.configuration.uniqueSpecs)[entry.datasetName];
  const currentTarget = entry.targets.find(target => target.id === column.currentTarget)!.name;
  const primary = keys?.primaryKey ?? (entry.configuration.rules[entry.datasetName].primaryKey ? [entry.configuration.rules[entry.datasetName].primaryKey] : []);
  const changes: string[] = [];
  if (target.id !== column.currentTarget) changes.push(`Target: ${currentTarget} → ${target.name}`);
  if (suggestion.type !== null && suggestion.type !== column.type) changes.push(`Type: ${column.type ?? "Not set"} → ${suggestion.type}`);
  if (suggestion.required !== null && suggestion.required !== column.required) changes.push(`Required: ${column.required ? "Yes" : "No"} → ${suggestion.required ? "Yes" : "No"}`);
  if (suggestion.key === "primary" && !(primary.length === 1 && primary[0] === currentTarget)) changes.push(`Primary key: ${primary.join(", ") || "None"} → ${target.name} (candidate)`);
  if (suggestion.key === "unique" && !keys?.uniqueKeys?.some(columns => columns.length === 1 && columns[0] === currentTarget)) changes.push(`Add unique key: ${target.name} (candidate)`);
  return changes;
}
export function hasSchemaSuggestionChange(context: SchemaMappingContext, suggestion: SchemaSuggestion): boolean {
  return schemaSuggestionChanges(context, suggestion).length > 0;
}
export function schemaSuggestionBasis(context: SchemaMappingContext, suggestion: SchemaSuggestion): string {
  const entry = entryFor(context), column = entry.columns.find(column => column.id === suggestion.sourceId)!;
  const target = entry.targets.find(target => target.id === (suggestion.targetId ?? column.currentTarget))!;
  const basis: string[] = [];
  if (target.id !== column.currentTarget) basis.push(target.template ? "selected template and source-header similarity" : "source-header normalization");
  if (suggestion.type !== null && suggestion.type !== column.type && target.template && target.type === suggestion.type) basis.push("template type supported by local values");
  if (suggestion.required !== null && suggestion.required !== column.required) basis.push("selected template's required-field rule");
  if (suggestion.key) basis.push("identifier/schema evidence and distinct, populated local values");
  return basis.length ? `Basis: ${basis.join("; ")}.` : "";
}
/** Compare schema metadata only; object property order is not a workspace change. */
export function sameSchemaConfiguration(left: TemplateConfiguration, right: TemplateConfiguration): boolean {
  function ordered(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(ordered);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, ordered(item)]));
    return value;
  }
  return JSON.stringify(ordered(left)) === JSON.stringify(ordered(right));
}
export function schemaColumnEvidence(context: SchemaMappingContext, sourceId: string): string[] {
  const column = entryFor(context).columns.find(column => column.id === sourceId);
  if (!column) throw new AiError("INVALID_CONTEXT");
  const messages = profileEvidence(column.profile);
  if (column.type) messages.push(`Configured type: ${column.type}; ${column.profile?.matches[column.type] ?? 0}/${column.profile?.nonEmpty ?? 0} populated values match. Inference does not change this rule.`);
  if (column.primary && (!column.profile || column.profile.empty || column.profile.duplicateRows)) messages.push("The existing primary-key setting is not supported by this snapshot. It remains unchanged; resolve the data or review the rule manually.");
  if (column.relationshipCount) messages.push(`${column.relationshipCount} existing relationship ${column.relationshipCount === 1 ? "declaration" : "declarations"}; reference validity still requires validation.`);
  else if (/_id$/i.test(column.name)) messages.push("No relationship is declared for this column. Its name and repeated values do not establish a foreign key.");
  if (column.profile?.nonEmpty && !column.profile.empty && !column.profile.duplicateRows && !column.allowedKeys.length) messages.push("Distinct values alone do not establish an intended key; no declared key or identifier evidence supports a key suggestion.");
  return messages;
}
export function schemaSuggestionExplanation(context: SchemaMappingContext, suggestion: SchemaSuggestion): string[] {
  const entry = entryFor(context), column = entry.columns.find(column => column.id === suggestion.sourceId)!;
  const target = entry.targets.find(target => target.id === (suggestion.targetId ?? column.currentTarget))!;
  const messages: string[] = [];
  messages.push(...profileDiagnostics(column.profile).filter(diagnostic => diagnostic.warning).map(diagnostic => diagnostic.message));
  if (suggestion.type) messages.push(`${column.profile?.matches[suggestion.type] ?? 0}/${column.profile?.nonEmpty ?? 0} populated values match ${suggestion.type}; ${column.type === suggestion.type ? "the existing configured type" : target.template && target.type === suggestion.type ? "the selected template's type" : "inferred from this browser-local snapshot"}.`);
  if (suggestion.key) messages.push(`${column.profile!.rows} rows checked with exact trimmed-string equality: no empty or repeated values. This is a ${suggestion.key} candidate for this snapshot, not a database guarantee.`);
  if (suggestion.required !== null) messages.push(`Requiredness follows ${target.template && target.required === suggestion.required ? "the selected template" : "the current configuration"}; absence of empty cells alone does not prove a business requirement.`);
  if (target.id !== column.currentTarget) messages.push("The target has supporting source-header/template similarity; confirm that the business meaning is the same.");
  if (!messages.length) messages.push("The model abstained from proposing supported type or constraint changes.");
  return messages;
}
export function possibleSchemaRenames(context: SchemaMappingContext, response: SchemaMappingResponse) {
  const entry = entryFor(context);
  return validateSchemaMappingResponse(context, response).suggestions.flatMap(suggestion => {
    const source = entry.columns.find(column => column.id === suggestion.sourceId)!;
    const target = entry.targets.find(target => target.id === suggestion.targetId);
    const previous = target && entry.templateHeaders.get(target.name);
    return previous && entry.drift.added.includes(source.name) && entry.drift.removed.includes(previous)
      ? [{ current: source.name, previous }] : [];
  });
}

/** Pure preview/commit candidate. Does not mutate workspace state or load an incompatible template. */
export function approveSchemaSuggestions(context: SchemaMappingContext, response: SchemaMappingResponse, selected: readonly string[]): TemplateConfiguration {
  const entry = entryFor(context), checked = validateSchemaMappingResponse(context, response);
  if (!selected.length || new Set(selected).size !== selected.length || selected.some(id => !checked.suggestions.some(suggestion => suggestion.sourceId === id))) throw new AiError("INVALID_RESPONSE");
  const candidate = structuredClone(entry.configuration), name = entry.datasetName;
  const accepted = checked.suggestions.filter(suggestion => selected.includes(suggestion.sourceId));
  if (accepted.some(suggestion => !hasSchemaSuggestionChange(context, suggestion))) throw new AiError("INVALID_RESPONSE");
  // Multiple primary-key candidates are alternatives, never an implicit composite key or last-write-wins.
  if (accepted.filter(suggestion => suggestion.key === "primary").length > 1) throw new AiError("INVALID_RESPONSE");
  const oldMapping = candidate.mappings[name];
  const newMapping = oldMapping.map((mapping, index) => {
    const suggestion = accepted.find(suggestion => suggestion.sourceId === `c${index}`);
    const target = entry.targets.find(target => target.id === suggestion?.targetId);
    return { ...mapping, target: target?.name ?? mapping.target };
  });
  const dataset = candidate.datasets.find(dataset => dataset.name === name)!;
  applyMapping({ ...dataset, filename: `${name}.csv`, rows: [], rowNumbers: [] }, newMapping);
  const renames = new Map(oldMapping.map((mapping, index) => [mapping.target, newMapping[index].target]));
  const rename = (column: string) => renames.get(column) ?? column;
  const currentRules = candidate.rules[name];
  const types = new Map(Object.entries(currentRules.types).map(([column, type]) => [rename(column), type]));
  const required = new Set(currentRules.required.map(rename));
  const rules = { ...currentRules, primaryKey: rename(currentRules.primaryKey), required: [] as string[], types: {} as typeof currentRules.types };
  const renameKeys = (text: string) => text.split(/\r?\n/).map(line => line.split(",").map(column => rename(column.trim())).join(",")).join("\n");
  const renamedTargets = [...renames].some(([before, after]) => before !== after);
  candidate.primaryOverrides[name] = renamedTargets ? renameKeys(candidate.primaryOverrides[name] ?? "") : candidate.primaryOverrides[name] ?? "";
  candidate.uniqueSpecs[name] = renamedTargets ? renameKeys(candidate.uniqueSpecs[name] ?? "") : candidate.uniqueSpecs[name] ?? "";
  for (const suggestion of accepted) {
    const index = entry.columns.findIndex(column => column.id === suggestion.sourceId), target = newMapping[index].target;
    if (suggestion.type !== null) types.set(target, suggestion.type);
    if (suggestion.required === true) required.add(target);
    if (suggestion.required === false) required.delete(target);
    const existingPrimary = buildWorkspaceKeyRules(entry.configuration.rules, entry.configuration.primaryOverrides, entry.configuration.uniqueSpecs)[name]?.primaryKey ?? (currentRules.primaryKey ? [currentRules.primaryKey] : []);
    if (suggestion.key === "primary" && !(existingPrimary.length === 1 && existingPrimary[0] === oldMapping[index].target)) { rules.primaryKey = target; candidate.primaryOverrides[name] = ""; }
    if (suggestion.key === "unique") {
      const unique = new Set(candidate.uniqueSpecs[name].split(/\r?\n/).filter(Boolean));
      unique.add(target); candidate.uniqueSpecs[name] = [...unique].join("\n");
    }
  }
  rules.required = [...required]; rules.types = Object.fromEntries(types);
  candidate.mappings[name] = newMapping; candidate.rules[name] = rules;
  const result = templateConfigurationSchema.parse(candidate);
  if (!checkTemplateCompatibility(result, entry.configuration.datasets).ok) throw new AiError("INVALID_CONTEXT");
  if (sameSchemaConfiguration(result, entry.configuration)) throw new AiError("INVALID_RESPONSE");
  return result;
}
