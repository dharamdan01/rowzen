import { z } from "zod";
import { AiError } from "../contracts";
import { readBoundedJson } from "../providers/bounded-json";
import { featurePrompt } from "../providers/prompts";
import { hostedResponseSchema, validateHostedResponse, type HostedRequest } from "../providers/hosted-contracts";
import type { hostedConfiguration } from "./config";
import { HostedServiceError } from "./service-error";

/** Groq structured-output subset. Full Zod + browser semantic constraints still validate the result. */
export function groqJsonSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(groqJsonSchema);
  if (!schema || typeof schema !== "object") return schema;
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (["$schema", "minItems", "maxItems", "pattern", "format"].includes(key)) continue;
    if (key === "const") output.enum = [value];
    else output[key === "oneOf" ? "anyOf" : key] = groqJsonSchema(value);
  }
  return output;
}
const completion = z.object({
  model: z.string(), choices: z.array(z.object({ finish_reason: z.string().nullable(),
    message: z.object({ content: z.string().max(8192).nullable(), refusal: z.string().nullish(),
      tool_calls: z.array(z.never()).max(0).optional() }) })).length(1),
});
export async function inferWithGroq(request: HostedRequest, config: ReturnType<typeof hostedConfiguration>, signal: AbortSignal) {
  const format = groqJsonSchema(z.toJSONSchema(z.object({ result: hostedResponseSchema(request) }).strict())) as object;
  let response: Response;
  try {
    response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST", cache: "no-store", redirect: "error", credentials: "omit", signal,
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ model: config.model, stream: false, temperature: 0, reasoning_effort: "low",
        max_completion_tokens: request.feature === "schema-mapping" ? 3072 : request.feature === "root-cause" ? 1792 : 1408,
        response_format: { type: "json_schema", json_schema: { name: "rowzen_advice", strict: true, schema: format } },
        messages: [{ role: "system", content: "Place the task output inside the result property. " + featurePrompt(request.feature, format) },
          { role: "user", content: JSON.stringify(request.metadata) }],
      }),
    });
  } catch { signal.throwIfAborted(); throw new HostedServiceError("HOSTED_UNAVAILABLE", "groq"); }
  if (!response.ok) {
    void response.body?.cancel().catch(() => {});
    const code = response.status === 429 ? "RATE_LIMITED"
      : [400, 401, 403, 404].includes(response.status) ? "HOSTED_CONFIGURATION"
      : response.status === 422 ? "INVALID_RESPONSE" : "HOSTED_UNAVAILABLE";
    throw new HostedServiceError(code, "groq", response.status);
  }
  const envelope = completion.safeParse(await readBoundedJson(response, signal));
  if (!envelope.success) throw new AiError("INVALID_RESPONSE", "RESPONSE_ENVELOPE");
  const choice = envelope.data.choices[0];
  if (choice.finish_reason === "length") throw new AiError("INVALID_RESPONSE", "TRUNCATED");
  if (envelope.data.model !== config.model || choice.finish_reason !== "stop" || choice.message.refusal || !choice.message.content) throw new AiError("INVALID_RESPONSE");
  let value: unknown;
  try { value = JSON.parse(choice.message.content); } catch { throw new AiError("INVALID_RESPONSE", "MODEL_JSON"); }
  const result = z.object({ result: z.unknown() }).strict().safeParse(value);
  if (!result.success) throw new AiError("INVALID_RESPONSE", "OUTPUT_SCHEMA");
  signal.throwIfAborted(); return validateHostedResponse(request, result.data.result);
}
