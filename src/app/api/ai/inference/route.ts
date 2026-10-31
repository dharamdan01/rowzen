import { getCurrentUser } from "../../../../lib/security/authorization";
import { createInferenceHandler } from "../../../../lib/ai/server/handler";

// Node.js is the framework default; an explicit runtime export is incompatible with cacheComponents.
export const maxDuration = 60;
// No CORS opt-in, unauthenticated diagnostics or browser-supplied identity.
export const POST = createInferenceHandler({ getUser: getCurrentUser, environment: () => process.env,
  reportFailure: failure => console.warn("[Rowzen hosted AI]", failure),
});
