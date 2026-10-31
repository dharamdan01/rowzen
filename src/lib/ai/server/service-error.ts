import { AiError, type AiErrorCode } from "../contracts";

/** Server-only diagnostics: never retain upstream bodies, URLs, headers or exceptions. */
export class HostedServiceError extends AiError {
  constructor(code: AiErrorCode, readonly service: "groq" | "rate-limit", readonly upstreamStatus?: number) {
    super(code);
  }
}
