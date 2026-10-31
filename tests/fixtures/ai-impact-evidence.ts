import { parseCsvText } from "../../src/lib/csv/parser";
import { identityMapping } from "../../src/lib/rehearsal/mapping";
import { revalidateCorrectionSnapshot } from "../../src/lib/corrections/revalidation";
import { captureTemplateConfiguration } from "../../src/lib/templates/workspace";
import { buildWorkspaceKeyRules } from "../../src/lib/rehearsal/workspace-config";
import type { DatasetRules, Relationship } from "../../src/lib/rehearsal/rules";
import type { CompositeForeignKey } from "../../src/lib/rehearsal/foreign-keys";
import type { ImpactReportInput } from "../../src/lib/ai/impact-evidence";

/** Synthetic canaries only; tests never read a user CSV, database or model service. */
export function impactFixture(input: {
  csv?: Record<string, string>;
  rules?: Record<string, DatasetRules>;
  relationships?: Relationship[];
  compositeRelationships?: CompositeForeignKey[];
  primaryOverrides?: Record<string, string>;
  uniqueSpecs?: Record<string, string>;
} = {}) {
  const csv = input.csv ?? { records: "id,email\n1,PRIVATE_EMAIL_A@example.test\n1,PRIVATE_EMAIL_B@example.test" };
  const datasets = Object.entries(csv).map(([name, content]) => parseCsvText(content, `${name}.csv`));
  const mappings = Object.fromEntries(datasets.map(dataset => [dataset.name, identityMapping(dataset.headers)]));
  const rules = input.rules ?? Object.fromEntries(datasets.map(dataset => [dataset.name, { primaryKey: "id", required: [], types: {} }]));
  const configurationInput = { datasets, mappings, rules, relationships: input.relationships ?? [], compositeRelationships: input.compositeRelationships ?? [], primaryOverrides: input.primaryOverrides ?? {}, uniqueSpecs: input.uniqueSpecs ?? {} };
  const verified = revalidateCorrectionSnapshot(datasets, { mappings, rules,
    relationships: [...configurationInput.relationships, ...configurationInput.compositeRelationships],
    keyRules: buildWorkspaceKeyRules(rules, configurationInput.primaryOverrides, configurationInput.uniqueSpecs) });
  let configuration: ImpactReportInput["configuration"] = null;
  try { configuration = captureTemplateConfiguration(configurationInput); } catch { /* Invalid configuration is intentional in configuration-only tests. */ }
  return { source: "LIVE_REPORT" as const, verified, configuration, datasets, rules, mappings };
}

export const impactRelationship = (childDataset: string, parentDataset: string): Relationship => ({ childDataset, childColumn: "id", parentDataset, parentColumn: "id" });

export function overlappingImpactFixture() {
  return impactFixture({
    csv: { departments: "id,name\n10,PRIVATE_DEPT_A\n20,PRIVATE_DEPT_B", students: "id,email,department_id\n1,,99\n1,PRIVATE_BAD_EMAIL,10\n2,PRIVATE_GOOD@example.test,10" },
    rules: { departments: { primaryKey: "id", required: [], types: {} }, students: { primaryKey: "id", required: ["email"], types: { email: "email" } } },
    relationships: [{ childDataset: "students", childColumn: "department_id", parentDataset: "departments", parentColumn: "id" }],
  });
}
