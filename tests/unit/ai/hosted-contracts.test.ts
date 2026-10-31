import { describe, expect, it } from "vitest";
import { parseHostedRequest, validateHostedResponse } from "../../../src/lib/ai/providers/hosted-contracts";
import { schemaFixture, schemaAnswer, schemaWireAnswer } from "../../fixtures/ai-schema-mapping";
import { serializeSchemaMappingContext } from "../../../src/lib/ai/schema-mapping";
import { rootCauseFixture, groundedKeyResponse } from "../../fixtures/ai-root-cause";
import { serializeRootCauseContext } from "../../../src/lib/ai/root-cause";
import { repairCandidateFixture } from "../../fixtures/repair-candidates";

const requests = () => {
  const repair = repairCandidateFixture();
  return [
    { feature: "schema-mapping", consent: true, metadata: JSON.parse(serializeSchemaMappingContext(schemaFixture().context)), answer: schemaWireAnswer(schemaAnswer) },
    { feature: "root-cause", consent: true, metadata: JSON.parse(serializeRootCauseContext(rootCauseFixture().context)), answer: groundedKeyResponse },
    { feature: "smart-repair", consent: true, metadata: repair.wire, answer: repair.recommendation },
  ] as const;
};
describe("hosted AI metadata allowlists (synthetic fixtures, no inference)", () => {
  it.each([0, 1, 2])("accepts the existing serializer and wire answer for feature %i", index => {
    const { answer, ...body } = requests()[index];
    const request = parseHostedRequest(body);
    expect(validateHostedResponse(request, answer)).toEqual(answer);
    expect(JSON.stringify(request)).not.toMatch(/PRIVATE_NOTE|PRIVATE_OTHER|first@example|second@example|Alpha|Beta|rowNumber|expectedValue/);
  });
  it.each(["records", "rows", "values", "history", "prompt", "outputSchema", "projectId", "userId"])('rejects injected top-level "%s" rather than forwarding it', key => {
    for (const { answer: _answer, ...request } of requests()) { void _answer; expect(() => parseHostedRequest({ ...request, [key]: "PRIVATE_CANARY" })).toThrow(expect.objectContaining({ code: "INVALID_CONTEXT" })); }
  });
  it.each([0, 1, 2])("requires explicit consent and rejects nested private payloads in feature %i", index => {
    const { answer: _answer, ...request } = requests()[index];
    void _answer;
    expect(() => parseHostedRequest({ ...request, consent: false })).toThrow();
    expect(() => parseHostedRequest({ ...request, metadata: { ...request.metadata, records: [{ secret: "PRIVATE_CANARY" }] } })).toThrow();
  });
  it("keeps raw-value fields out of schema profiles and preserves the 6 KiB budget", () => {
    const { answer: _answer, ...request } = requests()[0];
    void _answer;
    const value = structuredClone(request);
    Object.assign(value.metadata.columns[0].profile, { examples: ["PRIVATE_VALUE"] });
    expect(() => parseHostedRequest(value)).toThrow();
    const oversized = structuredClone(request);
    oversized.metadata.previousColumns = Array.from({ length: 16 }, () => "x".repeat(128));
    oversized.metadata.targets = Array.from({ length: 48 }, (_, index) => ({ ...oversized.metadata.targets[0], id: `t${index}`, name: "y".repeat(128) }));
    expect(() => parseHostedRequest(oversized)).toThrow(expect.objectContaining({ code: "CONTEXT_TOO_LARGE" }));
  });
  it("never accepts invented references, duplicate mappings or template evidence", () => {
    const { answer, ...body } = requests()[0], request = parseHostedRequest(body);
    expect(() => validateHostedResponse(request, { ...answer, suggestions: [{ ...answer.suggestions[0], targetId: "t99" }] })).toThrow();
    expect(() => validateHostedResponse(request, { ...answer, suggestions: [answer.suggestions[0], answer.suggestions[0]] })).toThrow();
    const noTemplate = parseHostedRequest({ ...body, metadata: { ...body.metadata, baselineAvailable: false } });
    expect(() => validateHostedResponse(noTemplate, answer)).toThrow();
  });
  it("rejects unknown/duplicate root-cause citations and model-supplied prose", () => {
    const { answer, ...body } = requests()[1], request = parseHostedRequest(body);
    expect(() => validateHostedResponse(request, { ...answer, explanations: [{ ...answer.explanations[0], issueIds: ["i999"] }] })).toThrow();
    expect(() => validateHostedResponse(request, { ...answer, explanations: [...answer.explanations, ...answer.explanations] })).toThrow();
    expect(() => validateHostedResponse(request, { ...answer, rawExplanation: "PRIVATE_PROSE" })).toThrow();
  });
  it("rejects repair target changes, unoffered strategies and replacement/verification fields", () => {
    const { answer, ...body } = requests()[2], request = parseHostedRequest(body);
    expect(() => validateHostedResponse(request, { ...answer, target: { ...answer.target, rowId: "r9" } })).toThrow();
    expect(() => validateHostedResponse(request, { ...answer, strategyId: "DATE_FROM_CONFIRMED_FORMAT" })).toThrow();
    for (const extra of [{ replacementValue: "PRIVATE_VALUE" }, { verified: true }, { sql: "DROP TABLE" }]) expect(() => validateHostedResponse(request, { ...answer, ...extra })).toThrow();
  });
});
