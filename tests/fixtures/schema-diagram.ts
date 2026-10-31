import { identityMapping } from "../../src/lib/rehearsal/mapping";
import type { SchemaDescriptorInput } from "../../src/lib/schema-diagram/types";

export function schemaDiagramInput(): SchemaDescriptorInput {
  const people = ["source_id", "billing", "shipping", "manager", "country", "region"];
  const addresses = ["id", "country", "region"];
  return {
    identity: { sessionId: 3, configurationKey: "PRIVATE_CONFIGURATION_IDENTITY" },
    datasets: [{ name: "people", headers: people }, { name: "addresses", headers: addresses }, { name: "notes", headers: ["body"] }],
    mappings: { people: [{ source: "source_id", target: "id" }, ...identityMapping(people.slice(1))], addresses: identityMapping(addresses), notes: identityMapping(["body"]) },
    rules: { people: { primaryKey: "id", required: ["billing"], types: { id: "integer", billing: "integer" } },
      addresses: { primaryKey: "id", required: [], types: { id: "integer" } }, notes: { primaryKey: "", required: [], types: {} } },
    uniqueSpecs: { addresses: "country, region" },
    relationships: [
      { childDataset: "people", childColumn: "billing", parentDataset: "addresses", parentColumn: "id" },
      { childDataset: "people", childColumn: "shipping", parentDataset: "addresses", parentColumn: "id" },
      { childDataset: "people", childColumn: "manager", parentDataset: "people", parentColumn: "id" },
      { childDataset: "people", childColumns: ["region", "country"], parentDataset: "addresses", parentColumns: ["region", "country"] },
      { childDataset: "addresses", childColumn: "region", parentDataset: "people", parentColumn: "id" },
    ],
  };
}

export function wideSchemaInput(count = 1000): SchemaDescriptorInput {
  const headers = Array.from({ length: count }, (_, index) => `column_${String(index).padStart(4, "0")}`);
  return { identity: { sessionId: 1, configurationKey: "many-columns" }, datasets: [{ name: "many", headers }],
    mappings: { many: identityMapping(headers) }, rules: { many: { primaryKey: headers[0], required: [], types: {} } },
    relationships: [{ childDataset: "many", childColumn: headers[0], parentDataset: "many", parentColumn: headers[count - 1] }] };
}
