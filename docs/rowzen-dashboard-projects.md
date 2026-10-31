# Rowzen dashboard and projects

Completed 27 October 2026 (Asia/Karachi). Scope: existing Dashboard and Projects presentation, project-owned navigation and a project-detail dialog within /projects. No standalone project-detail page existed; no new route or backend endpoint was invented.

## Delivered views and real sources

- Dashboard retains the existing authenticated server query for the three most recently created owned projects. Its counter is labeled as recent projects, never a global total.
- Recent activity reads the selected project's existing GET /api/projects/:id/runs endpoint. Actual counts/statuses/dates are shown, with the API's latest-50 limit disclosed. No dataset totals, trends, growth percentages or charts are fabricated.
- Projects retains the existing complete server-provided owned list. Search filters actual name/description; Name sorting uses a derived array. Counts distinguish an empty owned list from zero search matches. Opening/closing details preserves the current search and sort.
- Details uses the existing owner-checked GET /api/projects/:id, /runs and /templates endpoints. Project metadata must verify before navigation is shown. Templates show actual names/dates/counts and lead to that project's existing workspace; no fake Apply action is added.
- Workspace links preserve projectId. Report links retain exact project scope, and summary links reuse the existing history-return helper. Same-name projects remain distinct by ID.
- Loading, errors, verified zero and nonzero responses are separate states. Failed/malformed/unowned/mismatched responses never become empty arrays or zero counters. CONFIG_ERROR/null row counts are preserved.
- Cancellation and request identity prevent late responses from replacing a newer project's data. Closing details aborts its reads. Nothing is persisted to browser storage.
- Existing create/edit/delete network handlers, submit guards and cancellation semantics remain. The deletion warning now explicitly includes dataset metadata, alongside saved summaries and templates; browser-local CSV records are not claimed to be stored or deleted by this operation.

## Actual files

| File | Change |
| --- | --- |
| src/components/projects/dashboard-overview.tsx | Responsive recent-project/activity composition and real project selector. |
| src/components/projects/projects-view.tsx | Search/sort/counts, project cards, detail selection and focus restoration after filtered edits/first creation. |
| src/components/projects/project-details.tsx | New shared native-dialog detail view and existing scoped navigation/template reads. |
| src/components/projects/project-reports.tsx | New reusable scoped summary list with actual status/date/count metadata. |
| src/components/projects/use-project-resource.ts | Abortable, keyed browser-memory read lifecycle and retry. |
| src/lib/projects/presentation.ts | Zod metadata projections, response limits/scope validation and existing route helpers. |
| src/components/projects/project-delete-dialog.tsx | Warning text only; the remove handler is unchanged. |
| tests/unit/projects/presentation.test.ts | Response, scope, unknown counts, safe errors, limits and encoded-link tests. |
| tests/integration/projects-api.test.ts | Additional actual-handler detail-read authorization contracts with mocked identity/Prisma. |
| tests/e2e/rowzen-projects.public.spec.ts | New responsive detail/activity/search/focus/error/stale-response/System tests. |
| tests/e2e/projects-navigation.auth.spec.ts | Opt-in genuine-session list/detail/report-navigation test with isolated synthetic metadata and cleanup; not executed without setup. |
| tests/e2e/project-pages.public.spec.ts, helpers/theme-fixture.ts | Supply existing report-API responses for dashboard presentation fixtures. |

PRD, SRS, architecture and security documentation now record the view/read boundaries. Both server page queries, all APIs, Prisma, authorization, OAuth, workspace/correction owners, original palette/fonts and existing engines are unchanged.

## Verification

| Check | Actual result |
| --- | --- |
| Baseline project/ownership/history tests | 28 passed, 4 files, 1.91s. |
| Initial focused metadata/API tests | 38 passed. |
| Expanded project/API ownership selection | 41 passed. Actual route handlers use mocked identity/Prisma; this is not genuine-account attestation. |
| Final focused Vitest selection | **117 passed**, 13 files, 3.83s. |
| Combined selected Chromium regression | **126 passed** in one execution, 255.526s, 0 failures/skips/flaky cases/retries; includes CRUD, native dialogs, responsive views, templates, history, shell and workspace state/departure. |
| Separate System-theme detail/search check | **1 passed**, 6.0s, zero retries. |
| TypeScript | Passed; final standalone result recorded in typescript-final.log. |
| ESLint | Passed, zero errors; pre-existing unused samplePath warning in tests/e2e/release-privacy.auth.spec.ts:3 remains. |
| Production build | Passed on unchanged retry after the existing advisory gate. No upgrade/suppression. |
| Real authenticated list/detail and two-account isolation | **NOT TESTED**: primary/secondary legitimate session-state variables are absent. Browser-session inventory also failed to start with a sandbox helper setup error (helper_unknown_error: setup refresh had errors); no session was fabricated. |

The 126-case selection runs project-pages, rowzen-projects, rowzen-shell, layout, loading-states, history-navigation, theme-workflows, template-loading, workspace-departure and release-security public specs against the task-owned existing production build on port 3001, one worker, explicit --retries=0.

The separate System test verifies OS light/dark changes update the open detail dialog without closing it or clearing search. Responsive matrices cover 320/375/390/768/1024/1440px in light/dark. Original project CRUD, delete confirmation/cancellation/error/retry, keyboard focus, scoped links, template retry and workspace browser-state protection remain covered.

Issues found and corrected:
- The initial new matrix used getByLabel exact matches for wrapped selects. Browser accessibility snapshots showed correct combobox names; the tests now target those exact named combobox roles. The interrupted failing run is retained and is not reported as passing.
- A new focused regression reproduced lost focus when editing a filtered project removed its original Edit trigger. Focus now returns to Search; successful first creation returns focus to the surviving New project action. Cancellation retains native focus behavior.
- Visual inspection found the shared dialog's default maximum width overriding the detail class. The detail view now sets its intended responsive maximum width locally.
- Unescaped JSX apostrophes were corrected. No assertion, test timeout, safety control or ownership check was loosened.

## Preservation and privacy

The preservation manifest covers 137 pre-existing files: 136 remain byte-identical; the only permitted difference is deletion-warning text. TypeScript AST extraction verifies the original deletion handler remains identical. The editor handler and both authenticated server queries remain byte-identical.

Only existing same-origin authorized GET endpoints are used. Zod projections discard unused project configuration and any unknown record fields from UI state; wrong project identities, malformed JSON, unsupported statuses and impossible counts reject the response. Fixed error text does not echo server error prose. These client checks supplement existing server authorization.

No new database queries/endpoints, Prisma migration, dependency, raw CSV handling, model request, storage key or export behavior was introduced. All data shown in production comes from existing authenticated sources. Test screenshots use explicitly synthetic fixture/API data and are not presented as authenticated captures.

## Evidence and remaining gates

Evidence directory: playwright/.cache/rowzen-projects-20261027/.

- results-final.json, playwright-final.log: combined 126-case run.
- system-results.json, system-final.log: separate System check.
- baseline.log, focused-final-vitest.log, vitest-final.log.
- typescript-verified.log, lint-verified.log, build-final.log and build-final-retry.log.
- protected-before.json, protected-after.json, verification-summary.json, delete-handler-preservation.json.
- [Visual gallery](../playwright/.cache/rowzen-projects-20261027/gallery.html): 36 screenshots of the actual components with synthetic data, six widths and both themes.
- Early interrupted matrix and focus-regression failures remain retained.

The full Vitest/public-Playwright suites were not rerun for this focused project UI scope. The above results are actual scoped checks, not a claim of full-suite or real-account success. Dashboard activity is limited to recent projects and the selected project's latest 50 summaries; template lists use the existing 20 limit. The workspace's existing latest-50 project-picker behavior remains unchanged.

For real E2E, provide legitimate external PLAYWRIGHT_AUTH_STATE and independent PLAYWRIGHT_SECONDARY_AUTH_STATE files, matching the canonical hostname/origin. Then run the authenticated projects-navigation/security and release-cross-account specs. The new authorized navigation test creates only its own synthetic project/report metadata and deletes that owned test project in finally; it never modifies an existing project.

The known Next.js advisory remains a separate production release blocker. No push, commit, merge or deployment was performed.

Final TypeScript and ESLint checks passed after the added System test. git diff --check passed. The task-owned production server was stopped; the user's existing dev server on port 3000 was retained. Representative desktop and 320px dashboard/detail screenshots were visually inspected.

## Projects CRUD route restoration — 30 October 2026

Git comparison found the working route wiring in `40ce923`: the authenticated server page rendered `ProjectsView` with owned project metadata. The current branch instead retained the static page from `580e5a2`. Commit `d3178d6` added the interactive components and their fixture tests without bringing over that route wiring. Consequently the forms and POST/PATCH/DELETE handlers still existed, but the actual `/projects` page never mounted them. This was an integration omission, rather than a removed API or authorization failure.

The fix reconnects only `src/app/(dashboard)/projects/page.tsx` to the current Rowzen `ProjectsView`, selecting id/name/description while preserving the existing authentication gate, owner filter and newest-first ordering. Existing editor, deletion confirmation, validation, pending guards, local mutation updates, search, detail and report navigation are reused unchanged. No schema, auth, API handler or unrelated page was changed. `docs/SRS.md` now makes the route integration requirement explicit.

`tests/integration/projects-page.test.tsx` covers the real page-to-view connection, visible controls, scoped navigation, first-project creation entry point, authentication-before-query and error propagation. Before the fix, its control/empty-state cases failed (2 failed, 2 passed). After the fix, the complete Vitest run passed: **748 tests across 85 files**.

Actual final checks:

- `npm.cmd test`: 748 passed, 8.25s.
- `npx.cmd tsc --noEmit --incremental false`: passed.
- `npm.cmd run lint`: passed, zero errors; the existing unused `samplePath` warning in `tests/e2e/release-privacy.auth.spec.ts` remains.
- `npm.cmd run build`: passed, all 15 static pages generated; `/projects` remains dynamic.
- Production server on port 3001: project-pages and rowzen-projects public specs **68 passed** (1.1m); project pending-action selection from loading-states **4 passed** (10.4s); release-security public spec **3 passed** (2.5s). All used the public Chromium project, one worker and `--retries=0`: **75 passed total**.
- `git diff --check`: passed.

Browser coverage includes 320/375/390/768/1024/1440px, light/dark/System themes, create/edit immediate card updates, deletion/cancel/focus restoration, empty/search states, detail loading/errors/retry, mutation errors and pending/duplicate-submit guards. Representative actual 320px and 1440px component screenshots were visually inspected. Existing native dialog and API fixtures were retained without weakening tests.

Browser component CRUD uses synthetic metadata and intercepted API responses; actual handler authorization contracts use mocked identity/Prisma in Vitest. The release-security run separately verified the real private-page login redirects and anonymous API rejection. A preliminary HTTP-only probe expected a 307 but received the normal streamed 200 response; the existing browser redirect test passed. Genuine signed-in database CRUD and two-account isolation were **not run** because no legitimate authenticated session state was configured. This restoration does not claim real-account verification.

An initial combined browser command did not launch because Windows interpreted a grep regex pipe as a shell pipe. The successful runs above used separate spec/selection commands. No tests or product code were altered to accommodate it. Existing generated-file edits were kept outside this fix; no commit, push or deployment was performed.
