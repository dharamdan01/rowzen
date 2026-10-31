# Rowzen hosted AI deployment and restoration

30 October 2026. Restored into the current repository root from the earlier verified local source copy. No push, deployment, paid service activation or production data change.

## Current recovery status

The checkout at `f3fad1c` contained only `.env.example` and the manual-verification PDF from the latest work. Twenty-nine expected files were missing, including the hosted provider and API route; all of `src/lib/ai` was absent although the existing UI imported it. The AI changes and their missing local dependencies have now been recovered. Existing local environment secrets were not read, copied or staged.

The subsequent Vercel build repair resolved the committed conflict markers in 20 source/test files and four documents, restored missing imports/assets and patched Next.js to 16.4.3. A fresh isolated `npm ci` and hosted-mode production build now pass without copying real environment files or a generated Prisma client. Current Vitest: **735 passed, zero failed/skipped across 84 files**. TypeScript passes; lint has zero errors and one existing unused-import warning. See [the build repair report](vercel-build-fix.md) for exact commands, browser results and remaining security limits. These current checks are separate from the historical complete-workspace results below.

## Diagnosis and architecture

Originally all three assistants used browser-to-loopback Ollama. `127.0.0.1:11434` on a deployed page means the visitor's computer, not the developer's PC or a Vercel-hosted model. A visitor without approved local Ollama therefore cannot use that transport.

The restored integration provides explicit build-time transport selection:

```text
ollama (default): browser -> pinned local Ollama -> existing validators
groq (optional): browser -> authenticated /api/ai/inference -> Groq
                  -> response contracts -> original browser semantic checks
```

There is no automatic local/cloud fallback. Groq uses the pinned `openai/gpt-oss-20b` model, served by Groq rather than the OpenAI API. No new npm dependency is needed. Verify free-plan availability and account billing before enabling the service; no paid plan is activated by this change.

All three existing features use the adapter: schema mapping, root-cause/impact analysis and smart repair. Shared task prompts are preserved. Cell candidate construction, deterministic validation/What-if, explicit correction approval, Undo/Redo and export logic stay browser-local.

## Privacy and security

The owner approved the metadata-only integration; each user still needs explicit consent for the current snapshot. Hosted consent identifies Groq and external processing.

| Feature | Allowed metadata | Excluded |
| --- | --- | --- |
| Schema mapping | Column/target/template column names, configured rules, aggregate profiles/counts | Raw CSV values/rows, dataset/project names, corrections/history |
| Root-cause analysis | Issue codes/counts, opaque IDs, dependency evidence | Raw values, private dataset/column names, physical row coordinates, prose/history |
| Smart repair | Issue categories, offered strategy/input IDs, counts, opaque request/target IDs | Original/current/proposed values, private labels, source coordinates/history |
| Upstash rate limiter | Hashed application/user identifiers and expiring counters | CSV/schema/issue payloads, auth cookies/tokens, Groq credentials |

- Real Better Auth user identity is required; browser-supplied `userId`/`projectId`, arbitrary prompts, custom upstream URLs and unknown fields are rejected.
- Exact request Origin must equal canonical `BETTER_AUTH_URL`; no forwarded-host trust or CORS wildcard.
- HTTP body limit: 8 KiB while streaming. Original metadata budgets remain 6 KiB for mapping and 2 KiB for root cause/repair. Large root-cause reports need focused analysis.
- Server timeout 45 seconds, browser timeout 50 seconds, route duration ceiling 60 seconds. Signals propagate to upstream fetch; existing sessions discard cancelled/stale output.
- Shared fixed-window limits: 5 requests per authenticated user/minute and 200 per canonical application/day. Provider quotas can reject earlier. No automatic retry.
- Production requires atomic shared Upstash rate counters and fails closed when configuration/budget checks fail. Development may use bounded memory counters. Redis receives no CSV metadata.
- Browser cookies go only to Rowzen; upstream credentials stay server-side. Fixed upstream endpoint/model, redirect refusal, bounded output, strict contracts and original browser grounding checks remain enforced. No raw upstream errors/prompts/responses are logged.
- Groq's retention policy is external to Rowzen. Review its Data Controls/ZDR settings before real data; labels and aggregate counts can themselves be sensitive.

## Exact Vercel configuration

Configure the intended Preview or Production scope in Vercel Project Settings. Enter secrets directly into Vercel; never commit them or paste them in chat.

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_AI_PROVIDER` | `groq` (public build-time selector only) |
| `AI_HOSTED_ENABLED` | `true` |
| `GROQ_API_KEY` | Your server-only Groq free-plan project key |
| `AI_RATE_LIMIT_REDIS_REST_URL` | Exact HTTPS Upstash origin, e.g. `https://YOUR_DATABASE.upstash.io` |
| `AI_RATE_LIMIT_REDIS_REST_TOKEN` | Server-only write-capable Redis REST token |
| `BETTER_AUTH_URL` | Existing exact stable HTTPS application origin, without `/api/auth` |

Never set `NEXT_PUBLIC_GROQ_API_KEY` or a public Redis token. Remove and rotate any previously exposed credential. Existing OAuth/session/database settings remain necessary; this feature does not require changing Prisma or rotating working auth sessions.

1. Groq Console: verify Free Plan/model permissions/current limits; create a project key. Do not enable a paid plan or automatic upgrade.
2. Upstash Console: choose a free Redis store, copy REST URL and write token, and keep automatic paid upgrades off. Isolate Preview and Production stores; if separate free stores are unavailable, keep the unsupported environment disabled until an approved configuration exists.
3. Set the variables above in the matching Vercel scope. The built client's provider and server enable flag must agree.
4. Commit the restored files after reviewing the staged diff and resolving unrelated existing merge conflicts. Use the build scripts actually present in `package.json`. `next.config.ts` checks hosted configuration during the normal build.
5. Manually create a new Preview deployment of that commit. Old deployments are not updated by environment edits; the public selector requires rebuilding.
6. Verify real inference for all three features with a legitimate signed-in account and synthetic fixtures before any Production promotion. No deployed working claim is made here without that verification.

Local Ollama settings:

```ini
NEXT_PUBLIC_AI_PROVIDER=ollama
AI_HOSTED_ENABLED=false
```

Restart development after changing the public selector. Keep Ollama private; do not expose the daemon publicly. Hosted local testing later requires explicit mode selection, a securely entered key and the exact local auth origin; production runtime also requires the shared limiter.

## Verification and troubleshooting

Earlier complete workspace results: 1783 Vitest passed, 6 existing native MongoDB cases skipped; 82 local AI browser checks; 7 hosted development and 7 local production-build browser checks; 10 landing checks; 2 real local Ollama repair checks; TypeScript/lint and both provider-mode production builds passed. These are historical results, not a fresh pass for this restored checkout. Hosted success transport was mocked; the anonymous API denial exercised the real route.

Groq/Upstash live inference and authenticated Vercel smoke tests remain NOT RUN: the owner confirmed no Groq key. No sessions were fabricated.

After restoring/resolving the checkout, use actual package scripts for Vitest, lint, build and Playwright. Check TypeScript via the installed compiler when no typecheck script exists. Relevant new suites are under `tests/unit/ai/hosted-contracts.test.ts`, `tests/integration/ai/hosted-client.test.ts`, `hosted-server.test.ts`, `tests/unit/deployment/hosted-ai-environment.test.ts`, `tests/unit/security/hosted-ai-client-boundary.test.ts` and `tests/e2e/hosted-ai.public.spec.ts`.

Staging smoke: no consent means no request; all browser inference goes to Rowzen, not directly to Groq/Ollama in hosted mode. Mapping suggestions require explicit acceptance; root-cause hypotheses cite current findings; smart repair `boolean_review.csv` line 4 `active=yes` with confirmed yes/no should produce an eligible `true` candidate, resolve one finding with no introduced finding in What-if, then require explicit approval. `maybe` must never be guessed. Test cancellation, snapshot changes, Undo/Redo and export eligibility.

| Error | Check |
| --- | --- |
| Browser still requests loopback | Old build or public selector remains `ollama`; rebuild the correct scope |
| `AUTH_REQUIRED` | Sign in through the canonical site; do not bypass auth |
| `ORIGIN_REJECTED` | Browser origin must exactly match `BETTER_AUTH_URL` |
| `HOSTED_CONFIGURATION` | Enable flag, server key, model access, production Redis settings |
| `RATE_LIMITED` | Wait for application/provider quota; no automatic retry/paid fallback |
| `HOSTED_UNAVAILABLE` | Provider or limiter unavailable; manual workflows remain available |
| `HOSTED_TIMEOUT` | Retry explicitly later; data/history unchanged |
| `INVALID_RESPONSE` | Output rejected; never weaken schema/evidence checks |
| Input required/no supported repair | Obtain actual source meaning/value or use manual correction |

## Runtime HTTP 503 diagnosis — 30 October 2026

An HTTP 503 alone does not establish which dependency failed. The reported deployed failure has **not been reproduced or fixed on Vercel**: only the status was supplied, and this checkout's local environment has none of the hosted mode/key/Redis settings. No real Groq/Redis call was made during this diagnosis.

One confirmed error-handling defect is corrected: Groq HTTP 400 request rejection previously became `HOSTED_UNAVAILABLE` and misleadingly advised retrying. It now maps to `HOSTED_CONFIGURATION`; HTTP 422 maps to `INVALID_RESPONSE`. Redis HTTP 401/403 also maps to configuration failure. Transient/network failures still fail closed as unavailable. This classification change does not prove that any of these statuses caused the reported deployment failure.

The server route now emits a warning prefixed `[Rowzen hosted AI]` for failed 5xx requests. Its only fields are fixed `stage`/`code`, optional fixed `service` and numeric `upstreamStatus`. It excludes user/application IDs, URLs, credentials, headers, exceptions, prompts, provider bodies and CSV metadata. The browser still receives only the fixed error code/message. Diagnostic failure cannot bypass authentication, request validation or the shared limiter.

1. Commit/redeploy the diagnostic update yourself; do not use an old deployment when checking logs. Open the stable domain and sign in normally.
2. Reproduce once using synthetic data and explicit AI consent. Vercel → deployment → Runtime Logs → filter `/api/ai/inference` and `[Rowzen hosted AI]`. Share only the fixed fields below if help is needed, never the request payload or secrets.
3. Apply the matching remedy:

| Log fields | Action |
| --- | --- |
| `stage: configuration` | In the deployment's matching scope, verify `NEXT_PUBLIC_AI_PROVIDER=groq`, `AI_HOSTED_ENABLED=true`, server-only `GROQ_API_KEY`, both `AI_RATE_LIMIT_REDIS_REST_*` settings and exact canonical `BETTER_AUTH_URL`. Values must be real, not placeholder examples. Rebuild after changes. |
| `stage: rate-limit`, `upstreamStatus: 401` or `403` | Upstash Redis → Connect → REST: copy the HTTPS REST URL and the **Standard/write-capable** token from the **same database**. Do not use a Read Only, QStash or Vector token, `redis://` connection string, or a prefixed `Bearer ...` value. Store only the token in `AI_RATE_LIMIT_REDIS_REST_TOKEN`; keep it server-only. The limiter needs EVAL/GET/INCR/EXPIRE. |
| `stage: rate-limit`, another status or no status | Check that Redis is active/reachable, not paused/deleted, and within its account limits. Inspect the Upstash console for the cause. Do not disable limits, substitute process memory in production or activate a paid plan automatically. |
| `stage: inference`, `upstreamStatus: 400` | Groq rejected the request format/schema/parameters. Inspect Groq Console's error details privately; do not repeatedly retry or switch off structured validation. This integration uses strict JSON schema and the fixed `openai/gpt-oss-20b` model. A redacted, non-sensitive provider error code/reason is needed to diagnose further. |
| `stage: inference`, `upstreamStatus: 401`, `403` or `404` | Check that the Groq project key is valid and its project/organization permits the configured model. Groq and OpenAI API keys are different. Copy a permitted Groq key into Vercel's server-only setting, then redeploy. |
| `stage: inference`, `upstreamStatus: 500`/`502`/`503` or no status | Provider outage, upstream/network failure or unavailable capacity; check Groq's console/status and retry explicitly later. A fixed unavailable error never substitutes fake advice. |
| `stage: authentication` | Better Auth's user lookup failed before AI access. Check separate auth/database runtime health; changing a Groq key will not repair that stage. No sign-in bypass is permitted. |

Upstash distinguishes Standard and Read Only tokens in its [REST documentation](https://upstash.com/docs/redis/features/restapi). Groq documents [HTTP errors](https://console.groq.com/docs/errors) and [strict structured-output requirements/model support](https://console.groq.com/docs/structured-outputs). No automatic retry, provider fallback, schema weakening or data transfer is added by these diagnostics.

Current verification for this diagnostic update:

- Targeted hosted contracts/client/server/environment/credential-boundary suites: **68 passed**.
- `npm test -- --maxWorkers=4`: **744 passed, zero failed/skipped, 84 files**, exit 0. Vitest printed a worker-termination warning under the concurrent build/test workload; a separate hosted-server run (`--maxWorkers=1`) passed **34 tests** and exited cleanly without that warning. This does not establish why the earlier worker shutdown was slow.
- Installed `tsc --noEmit`: PASS. `npm run lint`: zero errors, one existing unused-import warning.
- Fresh isolated `npm ci` and `npm run build`: PASS on Node 24.22.1, synthetic hosted production settings, no real environment files or generated client copied.
- `npx --no-install playwright test tests/e2e/hosted-ai.public.spec.ts --project=public-chromium --reporter=list`, with an owned isolated production server: **7 passed**, exit 0. Includes the real anonymous route denial; successful inference transport is mocked, not live Groq verification.
- Live Groq/Redis/Vercel inference: **NOT RUN**; no hosted credentials available locally. The reported production 503 root cause is still unconfirmed.

Changed implementation: `src/lib/ai/server/{groq,rate-limit,handler,service-error}.ts`, `src/app/api/ai/inference/route.ts`; regression coverage: `tests/integration/ai/hosted-server.test.ts`; documentation: this guide and `docs/security.md`. Existing generated-client working-tree changes were present before this task and were left alone. No files were staged, pushed or deployed for this diagnostic update.

Rollback: set public selector to `ollama` and server enable flag to `false`, then manually rebuild/redeploy. Revoke hosted keys if retiring the integration. No database migration/data rollback is added by this feature.

References: [Groq structured output](https://console.groq.com/docs/structured-outputs), [limits](https://console.groq.com/docs/rate-limits), [data policy](https://console.groq.com/docs/your-data), [Upstash REST](https://upstash.com/docs/redis/features/restapi), [Vercel environment variables](https://vercel.com/docs/environment-variables).
