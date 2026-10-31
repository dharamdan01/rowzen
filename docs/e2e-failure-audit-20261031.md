# Full E2E failure audit - 31 October 2026

The original Playwright HTML report contained 462 public Chromium tests: 341 passed, 121 failed, 0 skipped, 0 flaky. All 121 retained error contexts were inspected and classified; the complete case inventory is below. Original HTML, traces, screenshots, error contexts and test results were copied to `playwright/.cache/full-e2e-audit-20261031/` before any rerun.

## Root causes and fixes

- **117 environment failures:** `page.goto` could not connect to `localhost:3000`. Refusals span 02:03:02 to 02:09:06 Asia/Karachi; the currently running dev-server process was created at 02:09:09, after that interval. No crash/OOM/termination cause was established from available server logs. The existing Playwright configuration can reuse an externally started dev server, whose lifetime Playwright does not control. Validation uses a separate task-owned production server on local port 3001, with the unchanged production build, explicit base URL and existing-server option. The user's dev server is retained. No product logic change is justified by a connection-refused failure.
- **4 ambiguous alert assertions:** hosted rate-limit and unauthorized errors, dependency cycles, and upload error feedback. Their actual application alerts rendered the expected messages, but the active Next.js page could also insert its accessible route-announcer alert after fixture mounting. Broad page-level alert locators then failed strict mode. Assertions now target the AI analysis region, graph fixture, or upload main landmark. Assertions, error/privacy checks, retries and timeouts are preserved; the route announcer is neither disabled nor removed.

Changed implementation files for this request are `tests/e2e/hosted-ai.public.spec.ts`, `tests/e2e/dependency-graph.public.spec.ts` and `tests/e2e/upload-presentation.public.spec.ts`. The original production configuration, application features, API handlers, auth/ownership checks, Prisma schema and packages are unchanged. Earlier work in the tree is retained.

Git comparison confirmed that the graph assertion in `d3178d6` and hosted-AI assertion in `fedf55c` already used the same broad page-level alert locators. The report shows correct component alerts, so restoring or rewriting application error handling would not address this selector ambiguity.

## Original failed-case inventory

The original cause is retained for each case. Final status was matched against the complete-run JSON by project, file and test title; all 121 original failures passed.

| File | Failed test | Original cause | Final status |
| --- | --- | --- | --- |
| `dependency-graph.public.spec.ts` | cycles, downstream blockage and the partial import order stay distinct | Ambiguous alert selector (Next route announcer)  Passed |
| `hosted-ai.public.spec.ts` | hosted rate is a real error with manual fallback and no fabricated explanation | Ambiguous alert selector (Next route announcer)  Passed |
| `hosted-ai.public.spec.ts` | hosted unauthorized is a real error with manual fallback and no fabricated explanation | Ambiguous alert selector (Next route announcer)  Passed |
| `rowzen-corrections.public.spec.ts` | manual draft, editor node and preview survive System changes and step navigation | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-corrections.public.spec.ts` | pack single-cell approval, What-if, history, multiline and export dark 1024px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-corrections.public.spec.ts` | pack single-cell approval, What-if, history, multiline and export dark 1440px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-corrections.public.spec.ts` | pack single-cell approval, What-if, history, multiline and export dark 768px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-corrections.public.spec.ts` | pack single-cell approval, What-if, history, multiline and export light 1024px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-corrections.public.spec.ts` | pack single-cell approval, What-if, history, multiline and export light 1440px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-exports.public.spec.ts` | Export uses actual formats and schema-only consent dark 1024px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-exports.public.spec.ts` | Export uses actual formats and schema-only consent dark 1440px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-exports.public.spec.ts` | Export uses actual formats and schema-only consent dark 320px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-exports.public.spec.ts` | Export uses actual formats and schema-only consent dark 375px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-exports.public.spec.ts` | Export uses actual formats and schema-only consent dark 390px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-exports.public.spec.ts` | Export uses actual formats and schema-only consent dark 768px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-exports.public.spec.ts` | Export uses actual formats and schema-only consent light 1024px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-exports.public.spec.ts` | Export uses actual formats and schema-only consent light 1440px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-exports.public.spec.ts` | Export uses actual formats and schema-only consent light 320px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-exports.public.spec.ts` | Export uses actual formats and schema-only consent light 375px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-exports.public.spec.ts` | Export uses actual formats and schema-only consent light 390px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-exports.public.spec.ts` | Export uses actual formats and schema-only consent light 768px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-exports.public.spec.ts` | System appearance and step changes retain schema choices and unchecked record consent | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-exports.public.spec.ts` | actual corrected CSV, SQL, JSONL, SVG and manifest downloads 1440px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-exports.public.spec.ts` | actual corrected CSV, SQL, JSONL, SVG and manifest downloads 320px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-exports.public.spec.ts` | bounded history keeps all rows and scoped pagination 1440px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-exports.public.spec.ts` | bounded history keeps all rows and scoped pagination 320px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-exports.public.spec.ts` | template reuse and saved-summary retry preserve corrected records 1440px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-exports.public.spec.ts` | template reuse and saved-summary retry preserve corrected records 320px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-audit.public.spec.ts` | appearance persistence failure is measured without changing workspace data | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-audit.public.spec.ts` | route and mounted-page audit dark 1024px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-audit.public.spec.ts` | route and mounted-page audit dark 1280px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-audit.public.spec.ts` | route and mounted-page audit dark 1440px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-audit.public.spec.ts` | route and mounted-page audit dark 320px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-audit.public.spec.ts` | route and mounted-page audit dark 375px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-audit.public.spec.ts` | route and mounted-page audit dark 390px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-audit.public.spec.ts` | route and mounted-page audit dark 768px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-audit.public.spec.ts` | route and mounted-page audit light 1024px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-audit.public.spec.ts` | route and mounted-page audit light 1280px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-audit.public.spec.ts` | route and mounted-page audit light 1440px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-audit.public.spec.ts` | route and mounted-page audit light 320px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-audit.public.spec.ts` | route and mounted-page audit light 375px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-audit.public.spec.ts` | route and mounted-page audit light 390px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-audit.public.spec.ts` | route and mounted-page audit light 768px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-states.public.spec.ts` | keyboard, no matches and 403/404 recovery dark 1024px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-states.public.spec.ts` | keyboard, no matches and 403/404 recovery dark 1280px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-states.public.spec.ts` | keyboard, no matches and 403/404 recovery dark 1440px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-states.public.spec.ts` | keyboard, no matches and 403/404 recovery dark 320px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-states.public.spec.ts` | keyboard, no matches and 403/404 recovery dark 375px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-states.public.spec.ts` | keyboard, no matches and 403/404 recovery dark 390px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-states.public.spec.ts` | keyboard, no matches and 403/404 recovery dark 768px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-states.public.spec.ts` | keyboard, no matches and 403/404 recovery light 1024px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-states.public.spec.ts` | keyboard, no matches and 403/404 recovery light 1280px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-states.public.spec.ts` | keyboard, no matches and 403/404 recovery light 1440px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-states.public.spec.ts` | keyboard, no matches and 403/404 recovery light 320px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-states.public.spec.ts` | keyboard, no matches and 403/404 recovery light 375px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-states.public.spec.ts` | keyboard, no matches and 403/404 recovery light 390px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-states.public.spec.ts` | keyboard, no matches and 403/404 recovery light 768px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-states.public.spec.ts` | native Chromium 200/400 percent zoom reflows every surface and retains workspace drafts | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-final-states.public.spec.ts` | real preference persistence, cross-tab synchronization and System follow OS | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | System theme follows OS changes without closing project details or clearing search | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | activity failure and retry do not invent an empty snapshot | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | creation from the first-project empty state restores focus to the surviving header action | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | dashboard scoped counters and activity dark 1024px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | dashboard scoped counters and activity dark 1440px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | dashboard scoped counters and activity dark 320px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | dashboard scoped counters and activity dark 375px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | dashboard scoped counters and activity dark 390px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | dashboard scoped counters and activity dark 768px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | dashboard scoped counters and activity light 1024px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | dashboard scoped counters and activity light 1440px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | dashboard scoped counters and activity light 320px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | dashboard scoped counters and activity light 375px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | dashboard scoped counters and activity light 390px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | dashboard scoped counters and activity light 768px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | editing a filtered project restores focus when the edited card leaves the results | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | project detail loading, ownership failure, resource error and zero remain distinct | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | projects search, detail scope and focus dark 1024px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | projects search, detail scope and focus dark 1440px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | projects search, detail scope and focus dark 320px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | projects search, detail scope and focus dark 375px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | projects search, detail scope and focus dark 390px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | projects search, detail scope and focus dark 768px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | projects search, detail scope and focus light 1024px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | projects search, detail scope and focus light 1440px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | projects search, detail scope and focus light 320px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | projects search, detail scope and focus light 375px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | projects search, detail scope and focus light 390px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | projects search, detail scope and focus light 768px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-projects.public.spec.ts` | slow previous-project activity cannot overwrite a newer selection | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-public.public.spec.ts` | Rowzen login layout, focus and session loading dark 1024px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-public.public.spec.ts` | Rowzen login layout, focus and session loading dark 1440px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-public.public.spec.ts` | Rowzen login layout, focus and session loading dark 320px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-public.public.spec.ts` | Rowzen login layout, focus and session loading dark 375px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-public.public.spec.ts` | Rowzen login layout, focus and session loading dark 390px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-public.public.spec.ts` | Rowzen login layout, focus and session loading dark 768px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-public.public.spec.ts` | Rowzen login layout, focus and session loading light 1024px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-public.public.spec.ts` | Rowzen login layout, focus and session loading light 1440px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-public.public.spec.ts` | Rowzen login layout, focus and session loading light 320px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-public.public.spec.ts` | Rowzen login layout, focus and session loading light 375px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-public.public.spec.ts` | Rowzen login layout, focus and session loading light 390px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-public.public.spec.ts` | Rowzen login layout, focus and session loading light 768px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-public.public.spec.ts` | login System follows OS changes without losing cancellation feedback | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-public.public.spec.ts` | public metadata, honest capabilities and all local link targets remain valid | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-review.public.spec.ts` | offline Root-Cause advice cannot change supplied findings or record navigation 320px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-review.public.spec.ts` | supplied CONFIG_ERROR keeps row validity unevaluated 1440px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-review.public.spec.ts` | supplied CONFIG_ERROR keeps row validity unevaluated 320px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-review.public.spec.ts` | supplied blocked Review preserves metrics, filters and navigation dark 1024px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-review.public.spec.ts` | supplied blocked Review preserves metrics, filters and navigation dark 1440px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-review.public.spec.ts` | supplied blocked Review preserves metrics, filters and navigation dark 320px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-review.public.spec.ts` | supplied blocked Review preserves metrics, filters and navigation dark 375px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-review.public.spec.ts` | supplied blocked Review preserves metrics, filters and navigation dark 390px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-review.public.spec.ts` | supplied blocked Review preserves metrics, filters and navigation dark 768px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-review.public.spec.ts` | supplied blocked Review preserves metrics, filters and navigation light 1024px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-review.public.spec.ts` | supplied blocked Review preserves metrics, filters and navigation light 1440px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-review.public.spec.ts` | supplied blocked Review preserves metrics, filters and navigation light 320px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-review.public.spec.ts` | supplied blocked Review preserves metrics, filters and navigation light 375px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-review.public.spec.ts` | supplied blocked Review preserves metrics, filters and navigation light 390px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-review.public.spec.ts` | supplied blocked Review preserves metrics, filters and navigation light 768px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-review.public.spec.ts` | supplied clean Review is READY with zero findings 1440px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `rowzen-review.public.spec.ts` | supplied clean Review is READY with zero findings 320px | Server unavailable (`ERR_CONNECTION_REFUSED`)  Passed |
| `upload-presentation.public.spec.ts` | upload error feedback remains accessible | Ambiguous alert selector (Next route announcer)  Passed |


## Verification

| Command / selection | Actual result |
| --- | --- |
| Original individual selector selection (before fixes) | 1 failed, 7 passed; dependency alert collision reproduced. The original report proves all four collision cases. |
| Same individual selection after fixes | 8 passed, 48.0s. |
| Exact original failed-test list via `--test-list` | 121 passed, 5.4m, zero retries, one worker. |
| `npm.cmd test` | 751 passed across 85 files, 10.06s. |
| `npx.cmd tsc --noEmit --incremental false` | Passed, exit 0. |
| `npm.cmd run lint` | Passed, zero errors; existing warnings in generated `coverage/block-navigation.js` and unused `samplePath` remain. |
| `npm.cmd run build` | Passed; compilation, TypeScript and all 15 static pages generated. |
| Complete `npm.cmd run test:e2e -- --retries=0 --reporter=line,json,html` | **462 passed, 0 failed, 0 skipped, 0 flaky**, 17.1m (1,023,482.352ms), exit 0. |

The exact failed-list rerun uses `PLAYWRIGHT_BASE_URL=http://localhost:3001`, `PLAYWRIGHT_USE_EXISTING_SERVER=1`, and `npm.cmd run test:e2e -- --test-list=playwright/.cache/full-e2e-audit-20261031/failed-test-list.txt --retries=0 --reporter=line --output=playwright/.cache/full-e2e-audit-20261031/failed-rerun`.

The complete configured suite was run with no test filter. JSON and HTML reports agree: 462 tests, 462 first attempts, zero global errors, and all 121 original failures recovered. Live authenticated tests are opt-in in the existing configuration; no legitimate primary/secondary session state is configured, and no session was fabricated. All selected API mutations either use intercepted synthetic responses or verify anonymous rejection before database access. No production database records are created, modified or deleted by this verification.

## Full-run evidence and repeat commands

The updated report is `playwright-report/index.html`, served by the already-running viewer at `http://localhost:9323/`. Machine-readable results are in `playwright/.cache/full-e2e-audit-20261031/full-results.json`; `verified-summary.json` compares JSON, HTML and every original failed case. Screenshots/traces from the original run remain in the evidence copy. The original blank connection-failure screenshot and a successful cycle-graph screenshot were visually inspected.

The full run used these process-local PowerShell settings:

```powershell
$env:PLAYWRIGHT_BASE_URL='http://localhost:3001'
$env:PLAYWRIGHT_USE_EXISTING_SERVER='1'
$env:PLAYWRIGHT_JSON_OUTPUT_NAME='playwright/.cache/full-e2e-audit-20261031/full-results.json'
$env:PLAYWRIGHT_HTML_OPEN='never'
npm.cmd run test:e2e -- --retries=0 --reporter=line,json,html
```

Before repeating this isolated production-build workflow, run `npm.cmd run build`, then keep `npm.cmd run start -- --port 3001` running in a separate terminal for the entire suite. With the existing default dev-server workflow on port 3000, a reused server must likewise remain running; its earlier exit reason could not be established from the supplied evidence. No automatic server restart was used to conceal errors.

No supported test failures remain. Real OAuth consent/token exchange, authenticated database CRUD/two-account tests and live provider responses are not attested by synthetic browser fixtures; the existing legitimate-session opt-in remains unchanged. Two unrelated lint warnings remain as recorded above. No tests were removed, skipped, disabled or weakened, and no timeout was increased. No commit, push, deploy or production database mutation was performed. The task-owned port-3001 server was stopped after verification; the user's dev server and report viewer were retained.

## Follow-up: theme focus before hydration

A later user run had 461 passes and one failure in `real preference persistence, cross-tab synchronization and System follow OS`. The supplied Desktop error context and retained trace show a readiness race missed by the preceding one-pass full run: immediately after `selector.focus()`, the select still had `disabled`; `selectOption()` then waited for enablement and selected dark, but did not restore the ignored focus request. The application's hydration guard was working as intended. The test caller had not waited for it before checking focus retention.

The race was reproduced deterministically by holding client scripts, focusing the disabled select, releasing scripts and asserting focus after selection. It failed with the same `Received: inactive` assertion. The original trace summary and reproduced failure are retained under `playwright/.cache/theme-focus-20261031/`.

`rowzen-final-states.public.spec.ts` now asserts that the control is enabled before focusing it, asserts focus before selection, and retains the original focus assertion after selection. The existing delayed-hydration regression in `theme.public.spec.ts` now proves both halves: focus on the disabled control is ignored; once enabled, focus is acquired and survives a real theme selection. Persistence, cross-tab and System checks remain intact. No application code, timeout or arbitrary sleep was added.

Initial follow-up checks: both relevant tests repeated ten times each passed **20/20**, zero retries, 55.6s. `npm.cmd test` passed **751 tests** in 85 files (7.45s); standalone TypeScript passed; ESLint passed with the same two existing warnings; production build passed all 15 static pages. Related production browser suites (`rowzen-final-states.public.spec.ts` and `theme.public.spec.ts`) passed **32/32** in 1.0m, including native 200%/400% zoom. A fresh complete configured suite passed **462/462**, with **0 failed, 0 skipped, 0 flaky and 0 retries**, in 15.3m (919,837.239ms), exit 0. JSON and HTML agree; both focus cases passed on their first attempts.


Follow-up full command: `npm.cmd run test:e2e -- --retries=0 --reporter=line,json,html`, using the same isolated local production server on port 3001 and existing-server environment flag, with `PLAYWRIGHT_JSON_OUTPUT_NAME=playwright/.cache/theme-focus-20261031/full-results.json` and `PLAYWRIGHT_HTML_OPEN=never`. The result and `verified-summary.json` are retained there. The latest HTML report is updated in `playwright-report/`. The task-owned server was stopped afterward; the user's dev server and report viewer were retained. Only the two theme/final-state spec files and this follow-up documentation changed for this fix. No application, authentication, database, timeout or assertion relaxation was introduced.
