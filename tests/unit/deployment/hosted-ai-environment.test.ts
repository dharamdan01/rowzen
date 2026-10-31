import { describe, expect, it } from "vitest";
import { aiEnvironmentErrors } from "../../../scripts/check-ai-env.mjs";

describe("hosted AI release configuration (no external services)", () => {
  it("leaves development/local Ollama enabled without hosted credentials", () => {
    expect(aiEnvironmentErrors({})).toEqual([]);
    expect(aiEnvironmentErrors({ NEXT_PUBLIC_AI_PROVIDER: "ollama", AI_HOSTED_ENABLED: "false" }, { production: true })).toEqual([]);
  });
  it("requires explicit opt-in, server credentials and a shared production budget", () => {
    const errors = aiEnvironmentErrors({ NEXT_PUBLIC_AI_PROVIDER: "groq" }, { production: true });
    expect(errors.join(" ")).toMatch(/AI_HOSTED_ENABLED/); expect(errors.join(" ")).toMatch(/GROQ_API_KEY/); expect(errors.join(" ")).toMatch(/shared request limits/);
  });
  it("accepts complete explicit production configuration without a service call", () => {
    expect(aiEnvironmentErrors({ NEXT_PUBLIC_AI_PROVIDER: "groq", AI_HOSTED_ENABLED: "true", GROQ_API_KEY: "SYNTHETIC_PRIVATE_KEY", AI_RATE_LIMIT_REDIS_REST_URL: "https://qa.upstash.io", AI_RATE_LIMIT_REDIS_REST_TOKEN: "SYNTHETIC_PRIVATE_REDIS" }, { production: true })).toEqual([]);
  });
  it("rejects mismatched modes, unknown providers, unsafe URLs and public secrets", () => {
    expect(aiEnvironmentErrors({ AI_HOSTED_ENABLED: "true" })).not.toEqual([]);
    expect(aiEnvironmentErrors({ NEXT_PUBLIC_AI_PROVIDER: "unknown" })).not.toEqual([]);
    for (const url of ["http://localhost:6379", "https://evil.test", "https://qa.upstash.io/path", "https://user:PRIVATE@qa.upstash.io"]) {
      const errors = aiEnvironmentErrors({ NEXT_PUBLIC_AI_PROVIDER: "groq", AI_HOSTED_ENABLED: "true", GROQ_API_KEY: "PRIVATE_KEY", AI_RATE_LIMIT_REDIS_REST_URL: url, AI_RATE_LIMIT_REDIS_REST_TOKEN: "PRIVATE_TOKEN" });
      expect(errors.length).toBeGreaterThan(0); expect(errors.join(" ")).not.toMatch(/PRIVATE_KEY|PRIVATE_TOKEN|user:PRIVATE/);
    }
    const errors = aiEnvironmentErrors({ NEXT_PUBLIC_GROQ_API_KEY: "PRIVATE_CANARY" });
    expect(errors.join(" ")).toMatch(/must not be public/); expect(errors.join(" ")).not.toContain("PRIVATE_CANARY");
  });
});
