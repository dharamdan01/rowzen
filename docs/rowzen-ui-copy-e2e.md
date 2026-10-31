# UI copy and E2E readiness verification

## Scope and changes

Landing and login copy now emphasizes mapping, reviewing and correcting data. The landing assistance section retains all three features, synthetic illustrations and verified-versus-suggested boundaries, with shorter feature labels. Provider-neutral privacy wording also covers the existing hosted integration.

Schema suggestions, issue analysis and repair planning retain explicit consent, metadata categories, processing destination and sensitivity/exclusion disclosures. Repeated optional/provider badges are replaced with useful context. Model names, endpoints, processing policy and no-fallback details are available in the shared keyboard-accessible **Processing details** disclosure. Request handlers, consent ownership, loading/cancellation/retry states, unverified result labels, preview/approval guards and provider contracts are unchanged.

## Reported failure

The original `test-results/.last-run.json` contained one failure: **BLOCKED data retains an inspectable draft schema without readiness claims** in `schema-diagram.public.spec.ts`. Its error context and trace showed the landing interface and HTTP 200 responses for document/styles/screenshots/local fonts, plus development HMR activity. It timed out at `waitForLoadState("networkidle")`, before the isolated workspace mounted. The retained trace does not establish a particular external service as the cause. The font is self-hosted through `next/font`; browser requests in the trace were local.

The original test passed individually before edits, confirming intermittency. Strengthening the same blocked-data test with an intercepted, intentionally pending background fetch reproduced its exact 75-second `networkidle` timeout. The fixture only needs loaded CSS and a hydrated host page, so whole-page network silence was an incorrect prerequisite. Playwright also [discourages networkidle for test readiness](https://playwright.dev/docs/api/class-page#page-wait-for-load-state).

`helpers/application-styles.ts` now checks the visible landing heading, the existing hydration-enabled theme control and loaded stylesheet objects. It captures the existing real styles and font class for the fixture. The schema fixture separately verifies its upload input and font readiness. The same unnecessary idle wait was removed from schema-mapping and smart-repair fixtures. No waits, retries or timeouts were increased.

The strengthened blocked-data test passed after the fix with the background request still pending. Its existing BLOCKED, complete relationship count and no-readiness-claim assertions remain. An intermediate DOM-content-only approach exposed a hydration race that could restore the landing tree over the fixture; the explicit enabled theme control resolves that race.

## Other failures found during the complete suite

The first complete development-server run finished with **459 passed, 3 failed, 0 skipped** in 36.7 minutes, all failures in `rowzen-projects.public.spec.ts`:

- **projects search, detail scope and focus light 320px**: the all-requests read-only assertion observed a POST to Next.js's `/__nextjs_original-stack-frames`. The trace contained a hydration warning caused by replacing the landing document before its React root hydrated. This was a diagnostic request, not a project mutation. The request assertion remains unchanged; the fixture now uses `applicationStyles` to prevent the premature DOM replacement.
- **slow previous-project activity cannot overwrite a newer selection**: the failure snapshot contained the landing page instead of the intended dashboard, from the same hydration race. The shared helper now waits for hydration/styles, and the fixture asserts its exact Projects/Dashboard heading instead of accepting any h1. Existing late-response and project-scope assertions remain.
- **activity failure and retry do not invent an empty snapshot**: the global alert locator matched both the application error and Next's hidden route announcer. The assertion now targets the Dashboard region's alert and still requires the same error message, absence of an invented empty state, and successful retry.

All three failing cases passed individually and as the complete project file against the existing development server before final regression verification. The final full suite passed against a separate local production build, as recommended by the installed Next.js Playwright guide; no tests or project configuration were removed or changed for that environment.

## Environment and evidence

Browser verification uses localhost and synthetic fixtures. No authenticated storage state, secondary-account state or live-model opt-in is configured. Existing authenticated and live-AI gates remain intact; fixture tests do not prove real provider consent, production database persistence or live model availability. No production stateful tests, push or deployment are performed.

Logs and the original failure artifacts are retained locally under ignored `playwright/.cache/ui-copy-audit/`.

| Check | Actual result |
| --- | --- |
| Original reported test, individually before edits | 1 passed; intermittent original failure. |
| Blocked-data test with pending background fetch, before readiness fix | Failed at the original 75-second networkidle wait. |
| Same strengthened test after readiness fix | 1 passed, including all original schema/readiness assertions. |
| Affected six-file E2E group | 132 passed, 0 failed/skipped, 11.7 minutes. |
| `npm.cmd test` | 775 passed, 89 files, 0 failed/skipped, 52.99 seconds. |
| `npx.cmd tsc --noEmit --incremental false` | Passed, exit 0. No `typecheck` package script exists. |
| `npm.cmd run lint` | Passed, exit 0, no errors. Existing warnings remain in generated `coverage/block-navigation.js` and unused `samplePath` in `release-privacy.auth.spec.ts`. |
| Three project failures, individual dev-server runs after fixes | Each passed: search/detail 7.3s, slow previous selection 5.3s, activity error/retry 5.0s. |
| `npm.cmd run test:e2e -- tests/e2e/rowzen-projects.public.spec.ts` | 30 passed, 0 failed/skipped, 1.2 minutes on the development server. |
| `npm.cmd run build` | Passed, exit 0; optimized compilation, TypeScript and 15/15 static pages. |
| TypeScript and lint repeated after the project-fixture edit/build | Both passed, exit 0; same two existing lint warnings. |
| Final complete `npm.cmd run test:e2e` on localhost:3001 | **462 passed, 0 failed, 0 skipped**, 14.5 minutes, exit 0; `.last-run.json` status passed with no failed IDs. |
| Final `npm.cmd test` repeat after all source/test edits and build | **775 passed**, 89 files, 0 failed/skipped, 21.92 seconds, exit 0. |
| Final `git diff --check` | Passed; no whitespace errors. |

The initial affected-group attempt was stopped after four failures from a capitalization mismatch in the new disclosure assertion. The assertion was corrected to match the displayed sentence; the completed 132-test run above passed. The hosted transport test now opens the disclosure before asserting the same processing-destination text. Existing functional/security assertions remain.

The final complete browser command uses the unchanged configured project/worker selection with a locally started production server:

```powershell
npm.cmd run start -- --port 3001
# Separate test process:
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:3001'
$env:PLAYWRIGHT_USE_EXISTING_SERVER = '1'
npm.cmd run test:e2e
```

These overrides apply only to that test process. The existing development server is retained. Only public, anonymous and mocked API workflows are enabled; no authenticated/stateful database E2E suite is run. The task-owned production server is stopped after verification. No tests were skipped, disabled, removed or weakened, and no arbitrary waits, retries or increased timeouts were introduced. Genuine authenticated, two-account and live-model workflows remain unverified because their existing external prerequisites are not configured.

Files changed for this task (pre-existing OAuth/configuration edits are separate):

- `src/app/page.tsx`, `src/app/login/page.tsx`
- `src/components/landing/ai-showcase.tsx`
- `src/components/ai/ai-presentation.tsx`, `schema-mapping-assistant.tsx`, `root-cause-analyzer.tsx`, `smart-repair-planner.tsx`
- `tests/e2e/helpers/application-styles.ts`
- `tests/e2e/schema-diagram.public.spec.ts`, `ai-schema-mapping.public.spec.ts`, `ai-smart-repair.public.spec.ts`, `ai-assistants-ui.public.spec.ts`, `hosted-ai.public.spec.ts`, `rowzen-projects.public.spec.ts`
- `docs/SRS.md`, `docs/rowzen-ui-copy-e2e.md`
