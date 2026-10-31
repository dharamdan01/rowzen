# Google and GitHub authentication

Implemented and verified locally on **26 October 2026**, using existing Better Auth **1.7.7**, its Prisma/PostgreSQL adapter, auth client and callback route. No new auth dependency or Prisma migration was introduced. `.env` was not edited and credential values were not displayed.

## Behavior and identity policy

The existing themed `/login` page offers **Continue with GitHub** and **Continue with Google**. Each action has its own loading label, a shared double-submission guard, fixed private error messages and an accessible status/alert. Both buttons disable during an active request. Browser page restoration clears pending state; late responses cannot replace a newer action's feedback. Existing session loading/reload, safe internal `next` continuation, theme controls and sign-out/departure protection remain in place.

An authenticated user can explicitly **Connect GitHub** or **Connect Google** through Better Auth's existing `linkSocial()` endpoint. Connections use the same verified email. Linking is not performed by the login page, email lookup, custom Prisma update or a resource transfer. Better Auth validates provider identity/state and authenticated account ownership before adding the provider to the existing `User.id`.

Policy is explicit:

- Linking remains enabled, but **implicit same-email linking is disabled**. A same-email sign-in through an unconnected provider returns `account_not_linked`; the UI directs the user to their existing provider and authenticated Connect action.
- Different-email linking and trusted-provider verification overrides are disabled. No Gmail alias/dot/plus normalization, automatic account merge, project reassignment or user-ID replacement occurs.
- Google requires a verified provider email. A Google-only `user.validateUserInfo` gate rejects unverified profiles before creation/linking/sign-in; the provider's normal verified-email session gate also remains enabled. GitHub's existing configuration and email policy are retained.
- Linking does not overwrite the existing user's name/image/profile. Accounts already owned by a different user are rejected. Reconnecting a provider updates its existing binding rather than creating another account in the tested sequential flows.
- User/Account/Session models, existing auth secret, authorization helpers and project/report/template ownership remain unchanged. Authorization continues to use session `user.id`, never provider email or client hints.

The pre-provisioning hook is intentional: the installed framework's `requireEmailVerification` option alone can provision an unverified row before denying a session. The added Google-only gate rejects that case before persistence; it does not replace token validation or weaken verification. Account linking still depends on Better Auth's verified identity and ownership checks.

## Setup

Use server-side environment variables:

```dotenv
BETTER_AUTH_URL="http://localhost:3000"
BETTER_AUTH_SECRET="<keep-the-existing-secure-secret>"
GITHUB_CLIENT_ID="<existing-client-id>"
GITHUB_CLIENT_SECRET="<existing-client-secret>"
GOOGLE_CLIENT_ID="<google-web-client-id>"
GOOGLE_CLIENT_SECRET="<google-web-client-secret>"
```

Google is enabled only when both Google variables are nonempty. Partial/missing Google configuration leaves GitHub configured; the Google action reports a fixed failure if unavailable. No credential variable is `NEXT_PUBLIC_*` or sent through React props. `.env.example` documents the variable names with empty OAuth placeholders; this repository's existing `.env*` ignore rule also ignores that local template, so the setup is documented here independently of it. No ignore rule was relaxed and no environment file was staged.

Create a Google OAuth **Web application** client, configure its consent screen/audience/test users as appropriate, and register exact callback URIs:

| Deployment | Authorized Google redirect URI |
| --- | --- |
| Local canonical origin | `http://localhost:3000/api/auth/callback/google` |
| Production | `https://<your-domain>/api/auth/callback/google` |

Preserve GitHub's `/api/auth/callback/github` registration and credentials. Set `BETTER_AUTH_URL` to the canonical origin for each deployment. `localhost`, `127.0.0.1`, different ports, schemes and trailing slashes are not interchangeable registrations/cookie contexts. The provider callback is different from the application's post-login `callbackURL` (`/dashboard` or an allowlisted internal destination). Google uses the framework's basic `openid`, `email`, `profile` scopes and account-selection prompt; no Drive/Gmail API, One Tap SDK, offline-access request or paid dependency was added. See [Better Auth Google setup](https://better-auth.com/docs/authentication/google).

## Security boundaries

`oauth-options.ts` is server configuration and is imported only by `auth.ts` in product code. `oauth-feedback.ts` is client-safe presentation: provider/action query parameters affect fixed wording only and never authorize a connection, choose a user or update data. Unknown error descriptions are not rendered, logged or persisted by the login component. Error callback URLs omit a prefilled `error` parameter because Better Auth appends its actual code; pre-filling it would mask cancellation/linking errors.

State, PKCE, Google token validation, cookies, origin/CSRF checks, sessions and provider-account subject extraction remain framework-owned. No checks are disabled in product configuration. Synthetic integration tests explicitly enable origin/CSRF checks because Better Auth otherwise skips origin checking by default in a test environment. They use random test secrets, an isolated memory adapter and simulated provider transport, not application sessions or a real database.

The login import-graph test rejects server auth options/Prisma and synthetic credential canaries in the client bundle. `scripts/verify-oauth-client-assets.ts` separately loads environment values locally and compares them with production browser JS/map bytes. It prints only counts, variable names and pass/fail; never credentials, authorization URLs or file contents. CSV records/history are not part of OAuth request construction. Existing sign-out still asks before departing a populated workspace and redirects only after successful sign-out.

## Actual verification results

Groups overlap; counts are not additive.

| Check | Executed result |
| --- | --- |
| Full Vitest, `npm.cmd test` | **PASS: 1,634 tests in 137 files**, including all existing CSV/validation/correction/AI/diagram/database-export/ownership suites |
| New isolated OAuth/configuration/client-boundary tests | **PASS: 20 tests in three files** (11 configuration/feedback, eight framework integration, one client-bundle boundary), included in full Vitest |
| Scoped development-origin Playwright | **PASS: 30/30**, including nine new UI cases, two opt-in real authorization-initiation cases, four existing auth-feedback, five continuation, three anonymous-security and seven workspace-departure cases |
| Production-origin Playwright | **PASS: 21/21**, nine new UI + four existing auth-feedback + five continuation + three anonymous-security cases; overlaps development coverage |
| TypeScript | `npx.cmd tsc --noEmit --incremental false`: **PASS** |
| ESLint | **PASS**, zero errors; one existing unused `samplePath` warning in `tests/e2e/release-privacy.auth.spec.ts` |
| Production build | Final `npm.cmd run build`: **PASS**, compiled/typechecked and generated 13/13 static pages. First attempt ended at the final existing Next.js `SecurityFatalError` advisory gate; one unchanged retry passed while retaining the warning. No dependency/check suppression was used. |
| Actual client asset secret scan | **PASS: 20 client files**, all three configured secret variables checked, no exposed values or missing variables |
| Genuine Google/GitHub sign-in completion and real two-account ownership | **NOT TESTED**, requires interactive provider sign-in/consent and legitimate authenticated states; no such sessions were fabricated |

The new isolated tests execute Better Auth's actual handlers, cookie/state/session logic and linking policy against its built-in memory adapter. Provider code exchange/userinfo responses are simulated. They verify new/returning Google identity, repeated GitHub sign-in, same-email rejection before explicit connection, both linking directions, no profile overwrite, no sequential duplicate rows, unverified-email rejection before provisioning, different-email/anonymous-link rejection, already-owned provider rejection even after an incoming email changes, cancelled/replayed/forged state, invalid code/malformed tokens, foreign callback rejection and real test-session invalidation on sign-out. This is not cryptographic or live provider identity attestation.

Real local initiation passed against the existing application auth route using configured environment variables. Both providers returned the expected authorization origin, public client ID parameter, exact local callback and state; Google also supplied S256 PKCE. Returned payloads contained only `url` and `redirect`, with no `client_secret`. The tests **did not navigate to Google/GitHub, validate Cloud Console registration, exchange a code, prove client-secret validity or create a real signed-in user**. Credential variables were present/nonempty, not declared valid merely from that check.

Browser cases cover 320/375/390/768/1024/1440px and Light/Dark/System, keyboard operation, mutually disabled buttons, retry/network failure, cancellation/account-linking guidance, hostile query strings, safe intended continuation, authenticated Connect presentation, stale feedback after page restoration, logout/departure preservation and anonymous private-page/API rejection. The authenticated presentation case is a synthetic client fixture, not a real session. An initial selector collision with Next's route announcer was fixed by scoping alerts to the page's main content; no application accessibility behavior was removed.

The earlier client-boundary assertion matched a shared SDK environment-variable **name**, not an exposed credential value. It was corrected to test the actual import boundary/canaries, and the separate actual-asset value scan above verifies the production output. No server credential was printed to diagnose it.

Executed browser selection:

```powershell
$env:PLAYWRIGHT_USE_EXISTING_SERVER='1'
$env:DATAREHEARSAL_REAL_OAUTH_INIT='1'
npx.cmd playwright test tests/e2e/oauth-login.public.spec.ts tests/e2e/auth-feedback.public.spec.ts tests/e2e/login-continuation.public.spec.ts tests/e2e/release-security.public.spec.ts tests/e2e/workspace-departure.public.spec.ts --reporter=line --output=playwright/.cache/oauth-verification-final
npx.cmd tsx scripts/verify-oauth-client-assets.ts
```

Logs are in ignored `playwright/.cache/oauth-*.log`, with scoped browser artifacts in the associated cache directories. The temporary production server used a process-only matching test base URL on loopback and was stopped after verification; the existing development server/configuration was retained. `.env`, auth client/callback route, sign-out, authorization helpers, Prisma schema/migrations and application resource APIs were not changed. No account migration, raw CSV persistence, push or deployment occurred.

## Required live release checks and limitations

1. Using an approved Google test account, complete first Google consent/callback, logout and return sign-in. Confirm one User and one Google Account with the same stable IDs on return.
2. Sign in as a real existing GitHub user and verify existing projects/reports/templates. Attempt same-email Google directly: it must request existing-provider sign-in instead of linking. While authenticated, explicitly Connect Google; then both providers must resolve to the original User ID and resources.
3. Verify Google-first explicit GitHub connection, declined consent, changed/unverified/mismatched email, already-owned provider and safe intended return URLs against real provider responses. Do not merge existing different-user records to make a test pass.
4. Run existing authenticated and distinct-two-account Playwright gates using legitimate `PLAYWRIGHT_AUTH_STATE` / `PLAYWRIGHT_SECONDARY_AUTH_STATE` on the exact origin. Neither state was configured during this work.
5. Verify duplicate/racing callback behavior against disposable real Prisma/PostgreSQL infrastructure before a production identity-integrity sign-off. `Account` still lacks a composite `(providerId, accountId)` database uniqueness constraint; no migration or existing-data cleanup was inferred or performed. Sequential no-duplicate tests do not prove distributed concurrency guarantees.

Existing unverified local-user gates are not disabled. Older/manual identity records may require separate verification/support; no backfill or automatic merge is attempted. Firefox/WebKit, a deployed HTTPS OAuth callback, token refresh/revocation and provider-account unlink management are not established by these checks. This change does not rotate secrets or revoke existing sessions.

**Implementation is ready for a scoped local interactive OAuth demonstration, conditional on valid provider registrations and consent. Production release remains blocked** by the outstanding Next.js 16.4.0 security advisory and the unexecuted real authenticated/two-account/concurrency gates. See [the prior release limitations](features-4-5-completion.md) and [Better Auth account-linking semantics](https://better-auth.com/docs/concepts/users-accounts#account-linking).

## Explicit connection recovery refinement (27 October 2026)

An account_not_linked response now offers a clear existing-provider recovery action. For example, Sign in with GitHub to connect Google returns to /login with bounded connection intent and the original safe destination. The user must then explicitly choose Connect Google. Its linkSocial callback returns to the connection screen; authenticated listAccounts evidence determines whether to show connected status. Errors/cancellation preserve intent for retry. Query hints never authorize linking or assert success. Normal sign-in callbacks, provider settings, verified-email policy, implicit-link rejection, user IDs and resource ownership are unchanged. See [current verification and remaining real OAuth gates](rowzen-public-demo-auth.md).

## Production provider-registration repair - 31 October 2026

The current branch's `src/lib/auth.ts` registered only GitHub, and the documented `src/lib/security/oauth-options.ts` was absent. The Google variables were already named in `.env.example`, but no code read them into `socialProviders.google`. Therefore even configured Google credentials could not enable Google. The installed Better Auth handler returns HTTP 404 / `PROVIDER_NOT_FOUND` when its active provider list has no matching provider; this is an authentication configuration error, not a missing Next.js route. The catch-all route already exports the correct GET/POST handlers and is unchanged.

The working implementation in `ded1910` contains the omitted helper and its safety tests. This repair restores that configuration and connects it to the existing Better Auth/Prisma instance. Complete nonblank Google credentials enable Google; missing/partial Google credentials keep GitHub available. It restores the intended Google verified-email pre-provisioning gate and provider session gate, explicit same-email linking, no trusted-provider bypass, no profile overwrite, and no unlink-all. The GitHub credentials, Prisma adapter, auth secret handling, session store, cookie defaults and resource authorization helpers are unchanged. No schema migration or existing account/session mutation is performed.

### Exact production configuration

Set these in the Rowzen Vercel project's **Production** environment, not only Development or Preview:

| Variable | Required setting |
| --- | --- |
| `GOOGLE_CLIENT_ID` | The Google OAuth **Web application** client ID for this app. |
| `GOOGLE_CLIENT_SECRET` | The matching client secret from that same Google client. |
| `BETTER_AUTH_URL` | `https://rowzen.vercel.app` (origin only, no `/api/auth` suffix). |
| `BETTER_AUTH_SECRET` | Preserve the existing production secret exactly; do not rotate it for this repair. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Preserve the working production GitHub credentials. |
| `DATABASE_URL` | Preserve the existing production database connection/session store. |

These are server-side variables; do not prefix credential names with `NEXT_PUBLIC_`, put them in `next.config.ts` client environment exports, or log/copy their values into a report. The Vercel project's actual values/scopes were not available for inspection, so no specific remote credential is claimed missing. The confirmed defect is the absent registration code.

In the matching Google Cloud Web client, register this exact authorized redirect URI:

```text
https://rowzen.vercel.app/api/auth/callback/google
```

Keep the working GitHub callback `https://rowzen.vercel.app/api/auth/callback/github`. Google setup and callback requirements are documented by [Better Auth](https://better-auth.com/docs/authentication/google). Keep the existing account-link policy: an existing GitHub user's same-email Google sign-in can legitimately return `account_not_linked`; sign in with GitHub and explicitly Connect Google rather than enabling implicit linking.

### Redeployment and verification

1. Include `auth.ts`, the restored `oauth-options.ts`, and the accompanying tests/documentation in the source commit deployed by Vercel's configured production branch. Redeploying an old GitHub-only commit will not apply this code repair.
2. Save the Production-scoped variables above. In **Deployments**, deploy/redeploy the updated source commit to Production. Existing deployments retain their earlier environment; [Vercel requires a new deployment for environment changes](https://vercel.com/docs/environment-variables/managing-environment-variables).
3. In a fresh browser session, choose Continue with Google. Its initiation request should return an authorization URL/redirect rather than `PROVIDER_NOT_FOUND`, and use the exact production callback above. Do not expose state, code, cookies or tokens when recording evidence.
4. Complete a permitted real Google login and return login, then check existing GitHub login/session continuity and explicit same-email Connect Google. These live provider/production checks remain to be performed after deployment; no production OAuth state or user data was written by this local verification.

### Regression and actual local checks

`tests/integration/oauth-registration.test.ts` imports the actual application auth module and Next.js handler under synthetic Production/Vercel variables, replacing only the Prisma adapter with isolated memory storage. Before the fix it failed because the provider list was only `github` (1 failed, 3 passed). After the fix, Google and GitHub initiation work with secure cookies, the unchanged environment secret, exact HTTPS callbacks and Google S256 PKCE, without creating real users/accounts/sessions. It also checks that a blank Google credential does not remove GitHub.

The previous configuration, OAuth state/session/linking and client-bundle safety tests were restored from the working implementation. Provider exchanges/userinfo are simulated, and the credential strings are synthetic; these tests do not establish actual Google client-secret validity or real provider identity attestation.

- Focused auth/ownership selection: **46 passed** in six files (`npm.cmd test -- tests/integration/oauth-registration.test.ts tests/integration/oauth-authentication.test.ts tests/unit/security/oauth-options.test.ts tests/unit/security/oauth-client-boundary.test.ts tests/unit/security/oauth-connection.test.ts tests/integration/projects-api.test.ts --maxWorkers=1`).
- Full serial Vitest: **775 passed**, 89 files, 33.86s (`npm.cmd test -- --maxWorkers=1`).
- Standalone TypeScript: passed (`npx.cmd tsc --noEmit --incremental false`).
- ESLint: passed, zero errors; two existing warnings in generated `coverage/block-navigation.js` and unused `samplePath` remain (`npm.cmd run lint`).
- Production build: passed, compiled/typechecked and generated all 15 static pages (`npm.cmd run build`).
- The first parallel focused attempt had two 5-second cold-import/bundling timeouts. The unchanged tests passed serially; no assertion or timeout was relaxed.

Only a read-only production login GET was made (HTTP 200). No real credential values were printed, no `.env` was modified, no production sign-in POST/callback was initiated, and no deployment, secret rotation, database write, staging or commit was performed by this repair. Other uncommitted changes, including the owner's `.gitignore` edit, are preserved.
