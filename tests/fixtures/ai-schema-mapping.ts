import { templateConfigurationSchema } from "../../src/lib/templates/schema";
import { buildSchemaMappingContext } from "../../src/lib/ai/schema-mapping";
import { createAiVersion } from "../../src/lib/ai/contracts";
import { parseCsvText } from "../../src/lib/csv/parser";
import { captureTemplateConfiguration } from "../../src/lib/templates/workspace";
import { identityMapping } from "../../src/lib/rehearsal/mapping";

export function schemaFixture(withTemplate = true) {
  const dataset = parseCsvText("id,email,name\n1,first@example.test,Alpha\n2,second@example.test,Beta", "contacts.csv");
  const configuration = templateConfigurationSchema.parse({
    version: 1, datasets: [{ name: "contacts", headers: ["id", "email", "name"] }],
    mappings: { contacts: [{ source: "id", target: "id" }, { source: "email", target: "email" }, { source: "name", target: "name" }] },
    rules: { contacts: { primaryKey: "id", required: ["id"], types: { id: "integer" } } },
    relationships: [], compositeRelationships: [], primaryOverrides: { contacts: "" }, uniqueSpecs: { contacts: "" },
  });
  const template = structuredClone(configuration);
  template.datasets[0].headers = ["id", "email", "full_name"];
  template.mappings.contacts[2] = { source: "full_name", target: "full_name" };
  template.rules.contacts.types.email = "email";
  template.rules.contacts.required.push("email");
  const context = buildSchemaMappingContext({ configuration, dataset, datasetName: "contacts", template: withTemplate ? template : null, version: createAiVersion() });
  return { configuration, template, context, dataset };
}
export const emailSuggestion = { sourceId: "c1", targetId: "t1", type: "email", required: true, key: "unique", reason: "template_match" } as const;
export const schemaAnswer = { schemaVersion: 1, suggestions: [emailSuggestion] } as const;
export function schemaWireAnswer(response: { schemaVersion: number; suggestions: readonly { type: string | null; required: boolean | null; key: string | null }[] }) {
  return { ...response, suggestions: response.suggestions.map(suggestion => ({ ...suggestion,
    type: suggestion.type ?? "unsure", required: suggestion.required === null ? "unsure" : suggestion.required ? "yes" : "no", key: suggestion.key ?? "none",
  })) };
}
export const studentSchemaCsv = "id,name,department_id\n1,Ali,10\n2,Sara,20\n3,Ahmed,99\n3,Bilal,10";
export function profiledSchemaFixture(csv = studentSchemaCsv) {
  const dataset = parseCsvText(csv, "students.csv");
  const configuration = captureTemplateConfiguration({ datasets: [dataset], mappings: { students: identityMapping(dataset.headers) },
    rules: { students: { primaryKey: dataset.headers.includes("id") ? "id" : "", required: [], types: {} } },
    relationships: [], compositeRelationships: [], primaryOverrides: {}, uniqueSpecs: {} });
  const context = buildSchemaMappingContext({ configuration, dataset, datasetName: "students", template: null, version: createAiVersion() });
  return { dataset, configuration, context };
}
export const contractSchemaCsv = "student_no,full_name,email_address,dept_code,enrolled_on,is_active,postal_code,tuition_fee\n1001,PRIVATE_NAME_A,PRIVATE_EMAIL_A@example.test,10,2025-09-01,true,00123,1250.50\n1002,PRIVATE_NAME_B,PRIVATE_EMAIL_B@example.test,20,2025-10-01,false,00456,1500.00\n1003,PRIVATE_NAME_C,PRIVATE_EMAIL_C@example.test,10,2025-11-01,true,00789,1750.25";
/** Synthetic eight-column contract case. Private canaries must never enter model metadata. */
export function schemaContractFixture() {
  return profiledSchemaFixture(contractSchemaCsv);
}
export const semanticProfileCsv = "id,email,name,enrolled_on,postal_code\n1,PRIVATE_GOOD@example.test,PRIVATE_NAME_A,2024-02-29,00123\n2,PRIVATE_BAD_EMAIL,PRIVATE_NAME_B,2025-02-30,00456\n1,,PRIVATE_NAME_C,,00789";
export function semanticProfileFixture() {
  return profiledSchemaFixture(semanticProfileCsv);
}
