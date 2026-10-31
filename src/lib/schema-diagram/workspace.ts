import type { SchemaDescriptorInput } from "./types";

/** Copy only applied schema metadata before crossing the React component boundary. */
export function captureSchemaDiagramConfiguration(input: SchemaDescriptorInput): SchemaDescriptorInput {
  return {
    identity: { sessionId: input.identity.sessionId, configurationKey: input.identity.configurationKey },
    datasets: input.datasets.map(dataset => ({ name: dataset.name, headers: [...dataset.headers] })),
    mappings: Object.fromEntries(Object.entries(input.mappings).map(([name, mappings]) => [name, mappings.map(entry => ({ source: entry.source, target: entry.target }))])),
    rules: Object.fromEntries(Object.entries(input.rules).map(([name, rule]) => [name, { primaryKey: rule.primaryKey, required: [...rule.required], types: { ...rule.types } }])),
    primaryOverrides: Object.fromEntries(Object.entries(input.primaryOverrides ?? {})),
    uniqueSpecs: Object.fromEntries(Object.entries(input.uniqueSpecs ?? {})),
    relationships: input.relationships.map(relation => "childColumns" in relation
      ? { childDataset: relation.childDataset, childColumns: [...relation.childColumns], parentDataset: relation.parentDataset, parentColumns: [...relation.parentColumns] }
      : { childDataset: relation.childDataset, childColumn: relation.childColumn, parentDataset: relation.parentDataset, parentColumn: relation.parentColumn }),
  };
}
