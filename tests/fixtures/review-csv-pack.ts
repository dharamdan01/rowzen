import { packDataset } from "./workspace-csv-pack";
import { identityMapping } from "../../src/lib/rehearsal/mapping";
import { captureTemplateConfiguration } from "../../src/lib/templates/workspace";
import { buildWorkspaceKeyRules } from "../../src/lib/rehearsal/workspace-config";
import type { DatasetRules, Relationship } from "../../src/lib/rehearsal/rules";
import type { CompositeForeignKey } from "../../src/lib/rehearsal/foreign-keys";
import type { WhatIfConfiguration } from "../../src/lib/corrections/what-if";

export type ReviewPackKind = "composite" | "composite-invalid" | "parallel" | "cycle";
export function relationshipPack(kind: ReviewPackKind) {
  const files = kind === "parallel" ? ["addresses.csv", "orders_two_fks.csv"] : kind === "cycle" ? ["cycle_a.csv", "cycle_b.csv"] : ["parent_composite.csv", kind === "composite" ? "child_composite_valid.csv" : "child_composite_invalid.csv"];
  const datasets = files.map(file => packDataset(`04_relationships/${file}`));
  const [parent, child] = datasets;
  const mappings = Object.fromEntries(datasets.map(dataset => [dataset.name, identityMapping(dataset.headers)]));
  const rules: Record<string, DatasetRules> = Object.fromEntries(datasets.map(dataset => [dataset.name, {primaryKey: "", required: [], types: {}}]));
  const relationships: Relationship[] = [];
  const compositeRelationships: CompositeForeignKey[] = [];
  const primaryOverrides: Record<string, string> = {};
  if (kind === "parallel") {
    rules[parent.name].primaryKey = "address_id"; rules[child.name].primaryKey = "order_id";
    for (const childColumn of ["billing_address_id", "shipping_address_id"]) relationships.push({childDataset: child.name, childColumn, parentDataset: parent.name, parentColumn: "address_id"});
  } else if (kind === "cycle") {
    rules[parent.name].primaryKey = "a_id"; rules[child.name].primaryKey = "b_id";
    relationships.push({childDataset: parent.name, childColumn: "b_id", parentDataset: child.name, parentColumn: "b_id"}, {childDataset: child.name, childColumn: "a_id", parentDataset: parent.name, parentColumn: "a_id"});
  } else {
    primaryOverrides[parent.name] = "campus_id, dept_id"; rules[child.name].primaryKey = "person_id";
    compositeRelationships.push({childDataset: child.name, childColumns: ["campus_id", "dept_id"], parentDataset: parent.name, parentColumns: ["campus_id", "dept_id"]});
  }
  const template = captureTemplateConfiguration({datasets, mappings, rules, relationships, compositeRelationships, primaryOverrides, uniqueSpecs: {}});
  const config: WhatIfConfiguration = {mappings, rules, relationships: [...relationships, ...compositeRelationships], keyRules: buildWorkspaceKeyRules(rules, primaryOverrides, {})};
  return {datasets, template, config};
}
