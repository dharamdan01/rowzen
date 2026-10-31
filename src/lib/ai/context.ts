import type { VerifiedCorrectionReport } from "../corrections/revalidation";
import { prepareReportExport } from "../reports/export";
import { templateConfigurationSchema, type TemplateConfiguration } from "../templates/schema";
import { buildWorkspaceKeyRules } from "../rehearsal/workspace-config";
import {
  AI_MAX_CONTEXT_BYTES, AiError, aiAcknowledgementSchema, aiVersionSchema, aiWireContextSchema,
  sameAiVersion, type AiAcknowledgement, type AiFact, type AiVersion,
} from "./contracts";

declare const contextBrand: unique symbol;
export type AiContext = Readonly<{ version: AiVersion; factCount: number; [contextBrand]: true }>;
const contexts = new WeakMap<object, { json: string; ids: ReadonlySet<string> }>();

/** Projects only explicit numeric/enum facts. No labels, descriptions, row values or free text. */
export function buildAiContext(input: {
  verified: VerifiedCorrectionReport; configuration: TemplateConfiguration;
  version: AiVersion; reportVersion: AiVersion;
}): AiContext {
  try {
    const version = aiVersionSchema.parse(input.version);
    if (!sameAiVersion(version, aiVersionSchema.parse(input.reportVersion))) throw new AiError("STALE");
    const configuration = templateConfigurationSchema.parse(input.configuration);
    const { report, analytics } = input.verified;
    if (report.issues.length > 10_000) throw new AiError("CONTEXT_TOO_LARGE");
    // Reuse existing canonical-report/analytics consistency checks. Never send this export.
    prepareReportExport(report, analytics, "json");
    const datasets = [...configuration.datasets].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    if (report.datasets.length !== datasets.length || !datasets.every(dataset => report.datasets.includes(dataset.name))) throw new AiError("INVALID_CONTEXT");
    const aliases = new Map(datasets.map((dataset, index) => [dataset.name, `d${index}`]));
    const { totalRows, validRows, invalidRows, errors, warnings } = report.totals;
    const facts: AiFact[] = [{ id: "r0", kind: "report", status: report.status, totalRows, validRows, invalidRows, errors, warnings }];
    const keys = buildWorkspaceKeyRules(configuration.rules, configuration.primaryOverrides, configuration.uniqueSpecs);
    for (const dataset of datasets) {
      const rules = configuration.rules[dataset.name];
      const typeCounts = new Map<string, number>();
      for (const type of Object.values(rules.types)) typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
      facts.push({ id: aliases.get(dataset.name)!, kind: "dataset", columns: dataset.headers.length,
        required: new Set(rules.required).size,
        primaryWidth: keys[dataset.name]?.primaryKey?.length ?? (rules.primaryKey ? 1 : 0),
        uniqueWidths: (keys[dataset.name]?.uniqueKeys ?? []).map(columns => columns.length),
        types: [...typeCounts].sort(([a], [b]) => a < b ? -1 : 1).map(([type, count]) => ({ type, count })) as Extract<AiFact, { kind: "dataset" }>["types"],
      });
    }
    const groups = new Map<string, Extract<AiFact, { kind: "issues" }>>();
    for (const issue of report.issues) {
      const key = JSON.stringify([issue.code, issue.severity, issue.category]);
      const previous = groups.get(key);
      groups.set(key, { id: "i0", kind: "issues", code: issue.code, severity: issue.severity, category: issue.category, count: (previous?.count ?? 0) + 1 });
    }
    [...groups].sort(([a], [b]) => a < b ? -1 : 1).forEach(([, group], index) => facts.push({ ...group, id: `i${index}` }));
    [...configuration.relationships, ...configuration.compositeRelationships].forEach((relationship, index) => facts.push({
      id: `f${index}`, kind: "relationship", parent: aliases.get(relationship.parentDataset) ?? null,
      child: aliases.get(relationship.childDataset) ?? null, width: "childColumns" in relationship ? relationship.childColumns.length : 1,
    }));
    const alias = (name: string) => { const value = aliases.get(name); if (!value) throw new AiError("INVALID_CONTEXT"); return value; };
    facts.push({ id: "g0", kind: "dependency", order: report.importOrder.map(alias), cycles: report.cycleGroups.map(group => group.map(alias)) });
    const wire = aiWireContextSchema.parse({ schemaVersion: 1, version, facts });
    const json = JSON.stringify(wire);
    if (new TextEncoder().encode(json).byteLength > AI_MAX_CONTEXT_BYTES) throw new AiError("CONTEXT_TOO_LARGE");
    const context = Object.freeze({ version: Object.freeze(version), factCount: facts.length }) as AiContext;
    contexts.set(context, { json, ids: new Set(facts.map(fact => fact.id)) });
    return context;
  } catch (error) { throw error instanceof AiError ? error : new AiError("INVALID_CONTEXT"); }
}

/** Only objects minted by the adapter can reach a provider; casts/clones are not capabilities. */
export function serializeAiContext(context: AiContext): string {
  const entry = contexts.get(context);
  if (!entry) throw new AiError("INVALID_CONTEXT");
  return entry.json;
}
export function validateAiAcknowledgement(context: AiContext, value: unknown): AiAcknowledgement {
  const entry = contexts.get(context);
  const parsed = aiAcknowledgementSchema.safeParse(value);
  if (!entry || !parsed.success || parsed.data.acknowledgedFactIds.some(id => !entry.ids.has(id))) throw new AiError("INVALID_RESPONSE");
  return Object.freeze({ ...parsed.data, acknowledgedFactIds: Object.freeze(parsed.data.acknowledgedFactIds) }) as AiAcknowledgement;
}
