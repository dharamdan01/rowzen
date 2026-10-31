import { createOllamaProvider } from "./ollama";
import { createHostedProvider } from "./hosted";

/** Public transport selection only. Credentials/configuration never enter the client graph. No fallback. */
export const hostedAi = process.env.NEXT_PUBLIC_AI_PROVIDER === "groq";
export const aiProcessingLabel = hostedAi ? "Hosted AI · Groq" : "Local AI";
export function createConfiguredAiProvider() {
  return hostedAi ? createHostedProvider() : createOllamaProvider();
}
