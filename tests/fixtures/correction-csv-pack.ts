import { packDataset } from "./workspace-csv-pack";
import { identityMapping } from "../../src/lib/rehearsal/mapping";
import { captureTemplateConfiguration } from "../../src/lib/templates/workspace";
import type { WhatIfConfiguration } from "../../src/lib/corrections/what-if";

export function correctionPack() {
  const boolean = packDataset("05_ai_repair/boolean_review.csv");
  const text = packDataset("06_export/escaping_unicode.csv");
  const datasets = [boolean, text];
  const mappings = Object.fromEntries(datasets.map(dataset => [dataset.name, identityMapping(dataset.headers).map(entry => ({...entry, target: entry.source === "active" ? "is_active" : entry.source === "description" ? "details" : entry.target}))]));
  const config: WhatIfConfiguration = {mappings, rules: {
    [boolean.name]: {primaryKey: "person_id", required: ["full_name"], types: {is_active: "boolean"}},
    [text.name]: {primaryKey: "record_id", required: ["details"], types: {postal_code: "string"}},
  }, relationships: []};
  const template = captureTemplateConfiguration({datasets, mappings, rules: config.rules, relationships: [], compositeRelationships: [], primaryOverrides: {}, uniqueSpecs: {}});
  return {datasets, boolean, text, config, template};
}
