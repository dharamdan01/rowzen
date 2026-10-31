# Rowzen landing, Google connection recovery and public CSV demo

27 October 2026. Implementation follows the new attached five-step request and docs/ROWZEN_UI_GUIDE.md. Existing uncommitted work was retained. No dependency, Prisma schema, private API, provider configuration or validation algorithm was changed.

## Step 1 — read-only audit

- src/lib/security/oauth-feedback.ts maps the reported text to account_not_linked. The installed Better Auth oauth2/link-account implementation deliberately rejects implicit same-email provider binding when disableImplicitLinking is true. src/lib/security/oauth-options.ts intentionally keeps that safeguard, verified Google email, no cross-email linking and no trusted-provider bypass.
- src/lib/auth-client.ts is the standard existing client; src/app/api/auth/[...all]/route.ts delegates GET/POST to toNextJsHandler(auth). The existing Connect buttons already call linkSocial. The UX gap was that an existing-provider sign-in returned to the ordinary destination instead of bringing the user back to connect the second provider.
- Both provider variables and the canonical localhost:3000 origin were present (presence/origin checks only, no credential output). The expected local Google callback remains http://localhost:3000/api/auth/callback/google. No Google Cloud registration or credential exchange was inferred from URL initiation.
- The previous /rehearsal page required exactly two files, exact students/departments basenames and id/name/department_id headers, and invented fixed rules for those samples. It used a separate direct Papa/core path instead of the canonical file reader/preflight projection.
- The existing landing already had the Rowzen identity, palette and real sample captures. It needed a direct live-demo action and the requested limited motion rather than a replacement design system.
- Baseline focused tests: **57 passed in 6 files**, 4.55s. No application files were edited until the audit was reported.

References: installed Better Auth source, [official account-linking documentation](https://better-auth.com/docs/concepts/users-accounts#account-linking), and [Linear](https://linear.app/) for broad visual inspiration only. No third-party assets, layouts or copy were copied.

## Step 2 — secure Google connection recovery

Files: src/app/login/page.tsx, new src/lib/security/oauth-connection.ts, new src/components/auth/connected-method.tsx, new tests/unit/security/oauth-connection.test.ts and new tests/e2e/oauth-connection.public.spec.ts.

1. A Google account_not_linked callback offers **Sign in with GitHub to connect Google** (and the inverse recovery for GitHub).
2. This explicit action returns to a fixed local /login connection screen, retaining only an allowlisted provider and the original safe internal destination.
3. After authentication, the user explicitly selects **Connect Google**. Better Auth linkSocial remains responsible for state, identity, verified email and ownership.
4. The connection callback returns to this screen. Connected status comes from the existing authenticated listAccounts endpoint, not query parameters. Failed reads block the connection button and offer Retry.
5. Cancellation/error callbacks preserve connection intent; ordinary sign-in/linking destinations remain unchanged when there is no connection intent. The original account_not_linked message is retained as a safeguard, with actionable controls added.

No real account records were queried or manually edited. The reported error's code path is identified; the user's individual provider binding was not independently attested. There is no automatic merge, email normalization, account recreation or project reassignment.

Step-specific tests: **50 auth/security tests passed**. Four new browser cases cover recovery destination, explicit linkSocial approval/retry, provider-list-backed success and failed-list retry. Simulated signed-in presentation is explicitly labeled in source and evidence.

## Step 3 — small public custom-CSV demo

Files: src/app/rehearsal/page.tsx, src/app/rehearsal/layout.tsx, new src/lib/demo/configuration.ts, new tests/public-demo.test.ts, new tests/e2e/public-demo.public.spec.ts. Existing demo-alignment, route-title and branding specs were updated for the intentional new workflow/title.

- Choose **1 or 2** independent CSVs, up to **1 MB each**, strict UTF-8 and comma-separated records. Reuses readCsvFile/parseCsvText for BOM, empty/duplicate headers, malformed rows and physical CSV lines.
- Configure explicit optional string/integer/number/boolean/date/email checks, requiredness, a primary/composite key and independent single-column unique keys. Defaults are **Not configured**; nothing is inferred from headers or values.
- Explicit single-column cross-file relationships become available with two datasets. Canonical preflight diagnoses missing/nonunique/incompatible endpoints and preserves CONFIG_ERROR and null unevaluated counts.
- Optional sample CSVs and an explicit students/departments example-rule action remain available. The same two-file relationship/count/order checks continue passing.
- Identity mappings, existing revalidateCorrectionSnapshot/preflight/analytics and prepareReportExport are reused. No duplicate validation engine or automatic repair exists.
- Parsed record strings, including leading zeros and multiline content, are not altered. File replacement, rule changes and clearing invalidate results/downloads. A monotonically increasing read attempt prevents older file reads from restoring replaced/cleared state.
- Column editors paginate at 20 columns and findings at 50. Narrow tables retain the shared accessible horizontal-scroll region.
- Report JSON now uses the canonical metadata-only report export plus a demo-scope notice. The existing demo filename datarehearsal-report.json is retained; its former legacy JSON shape intentionally changes to the canonical exportVersion:1 shape (summary, issues, dependency, privacy/scope notices). Records are excluded.
- No CSV, configuration or results are sent to private APIs, browser storage, analytics or logs. Refresh clears the demo.

Step-specific parser/model tests: **23 passed**. Tests cover arbitrary and hostile-looking headers, leading zeros, multiline locations, original snapshot preservation, no inferred rules/FKs, types, required/composite/unique keys, missing references, configuration errors, stale mappings, size/count/encoding/parser limits and metadata-only export.

## Step 4 — landing polish

Files: src/app/page.tsx, src/components/landing/landing-header.tsx, src/components/landing/product-preview.tsx and src/components/landing/landing.css.

Direct Try Demo navigation and Try live demo hero CTA lead to /rehearsal. The existing headline, genuine labeled screenshots, six-step workflow, precise browser-local privacy and preflight-versus-execution distinction remain. Benefits now emphasize Validate, Understand and Correct.

Small CSS hero entrances and a once-only IntersectionObserver preview reveal are enabled only when motion is permitted. Content remains visible without observer support. There is no autoplay, continuous movement, parallax, animation library, new palette or font. All 17 local public/landing files remain byte-identical; no landing previews were regenerated.

Combined step 2–4 tests: **66 passed** before broad verification.

## Step 5 — actual verification

| Check | Actual result |
| --- | --- |
| Final full Vitest, npm.cmd test -- --maxWorkers=1 | **1,664 passed**, 141 files, 104.39s. |
| Independent engine, npx.cmd tsx --test tests/engine.test.mjs | **5 passed**, no skips. |
| Focused production Chromium, five specs, zero retries | **43 passed**, 52.7s. |
| Full configured public Chromium suite | **RUNNING — results to be recorded after completion.** |
| Real explicit Google connection | **USER-CONFIRMED PASS**: the user completed the requested existing-provider / Connect Google flow and reported Google connected successfully. Not an automated browser trace or two-account attestation. |
| Separate real Google/GitHub authorization initiation | **2 passed**, 7.7s; real existing server configuration on its canonical localhost:3000 origin. |
| TypeScript, npx.cmd tsc --noEmit --incremental false | Passed, exit 0. |
| ESLint, npm.cmd run lint | Passed, 0 errors; existing unused samplePath warning in tests/e2e/release-privacy.auth.spec.ts:3 remains. |
| Production build, npm.cmd run build | Passed on an unchanged retry after the existing Next.js security-advisory gate; no upgrade or suppression. |
| Protected source SHA-256 | **131 files unchanged**, including all pre-existing src/lib, API, Prisma, package/config, root theme/font, workspace owners and preview files. |

Early results are retained honestly: the first new demo test import used the wrong relative depth; a type projection needed a narrowed nonempty type tuple; lint rejected a nested provider renderer capturing the submission-ref handler; and two first browser assertions matched Next's route announcer in addition to the intended alert. The renderer is now a small component, and alert assertions target main content while retaining their exact expected messages. No safety control, assertion, timeout, layout-shift or screenshot-transfer threshold was loosened.

Coverage: 320/375/390/768/1024/1440px, light/dark and existing System theme tests; real custom-file inputs, rule invalidation, metadata downloads/no raw-value canary, no record POSTs or browser storage, malformed/oversized/non-UTF-8 inputs, sample compatibility, explicit foreign keys, keyboard approval/focus, no page overflow, console errors, live-demo links and reduced-motion behavior. Existing landing tests retain their <0.1 CLS and <250KB initial screenshot-transfer budgets.

Manual/visual checks: desktop and 320px demo screenshots inspected; a separate 320px keyboard run validated a custom file and scrolled the findings region using ArrowRight (420px), with zero record POSTs and no whole-page overflow. All 12 additional recovery-layout checks passed; these captures use anonymous-session fixtures and a synthetic callback hint; they are not authenticated-account proof.

## Evidence

Directory: playwright/.cache/rowzen-demo-oauth-20261027/.

- baseline.log, oauth-step2.log, demo-step3-corrected.log, steps2-4.log.
- vitest-final.log, engine.log, typescript-final.log, lint-corrected.log.
- build-final.log (retained advisory failure), build-final-retry.log (success).
- focused-final-results.json and playwright-focused-final.log; first failed run retained separately.
- results-full.json and playwright-full.log for the full configured browser run.
- live-oauth-results.json and live-oauth.log, kept separate from provider/session fixtures.
- protected-before.json, protected-after.json, verification-summary.json, recovery-layout.json and manual-keyboard-320.png.
- [Visual gallery](../playwright/.cache/rowzen-demo-oauth-20261027/gallery.html): 36 local screenshots across landing, custom demo and recovery presentation; real OAuth initiation is separate.

## Limits and readiness

- The user subsequently confirmed **Google connected successfully** after being asked to try the existing-provider connection flow. This is a user-confirmed manual success, not independently captured automation or verification of account IDs/project ownership.
- Independent real Google/GitHub consent/code-exchange automation, new/returning-user login, actual sign-out and distinct two-account ownership remain **NOT TESTED** without legitimate authenticated states. The memory-adapter integration tests execute actual Better Auth handlers with simulated provider transport. Real initiation checks only authorization URL generation, callback URI, state/PKCE and absence of secret parameters; they do not prove Google Cloud registration or completed identity verification.
- The public demo is intentionally limited: two CSVs, declared field checks, primary/composite keys, single-column unique keys and single-column relationships. It does not expose project/template/history APIs, AI, correction editing, advanced composite FKs, schema diagrams or database artifacts. Those authenticated capabilities remain unchanged.
- Canonical parser/validator semantics remain in effect: header whitespace is trimmed, duplicate headers compare case-insensitively, typed empty fields require a separate Required rule, and comparisons are not a simulation of every target database.
- READY applies only to configured static checks. No real database import, import compatibility guarantee or automatic data repair is claimed.
- The known Next.js security advisory is still a separate **production release blocker**. A successful retry is not remediation.
- Chromium verification is not full WCAG certification or Firefox/WebKit coverage.
- No commit, push, merge or deployment is performed.

The task-owned production server was stopped after verification; the existing dev server on port 3000 was retained. Local public-demo and fixture-driven recovery checks are green. Production release remains blocked by the advisory and real authenticated release gates.
