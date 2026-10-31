import { AI_MAX_RESPONSE_BYTES, AiError } from "../contracts";

/** Bound bytes during streaming, not after an unbounded response.text()/json() allocation. */
export async function readBoundedJson(response: Response, signal: AbortSignal, maxBytes = AI_MAX_RESPONSE_BYTES): Promise<unknown> {
  if (!response.headers.get("content-type")?.toLowerCase().startsWith("application/json") || !response.body) {
    void response.body?.cancel().catch(() => {}); throw new AiError("INVALID_RESPONSE", "HTTP_FORMAT");
  }
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", abort, { once: true });
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted(); const { done, value } = await reader.read(); signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { void reader.cancel().catch(() => {}); throw new AiError("RESPONSE_TOO_LARGE"); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new AiError("INVALID_RESPONSE", "UTF8"); }
    try { return JSON.parse(text); } catch { throw new AiError("INVALID_RESPONSE", "HTTP_JSON"); }
  } finally { signal.removeEventListener("abort", abort); reader.releaseLock(); }
}
