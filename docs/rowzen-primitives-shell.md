# Rowzen shared controls and navigation

Completed 27 October 2026 (Asia/Karachi). Scope: the existing shared UI and authenticated shell, following the approved audit and Rowzen guide. No subsequent landing/dashboard/workspace redesign phase was started.

## What changed

| Files | Refinement |
| --- | --- |
| `src/components/ui/primitives.tsx` | Consistent medium-weight buttons, 150ms reduced-motion-aware feedback, shared Textarea fields, contained keyboard-scroll tables, one Dialog/Drawer presentation, semantic StatusMessage, decorative Skeleton and readable empty/loading states. Existing prop/ref forwarding, submit intent, field limits, disabled/busy and caption/header semantics remain. |
| `src/components/ui/page-loading.tsx` | Reuses the decorative Skeleton primitive while retaining the real loading label, status region, busy state and stable compact/full geometry. |
| `src/components/ui/dialog-focus.ts` | One shared Tab-boundary helper for the actual client modal owners. Native dialogs still own inertness, Escape and focus return. Modified browser-tab shortcuts and already-prevented events are not intercepted. |
| `src/components/layout/dashboard-nav.tsx` | Real four-link sidebar with clearer hover/caption density; larger breadcrumb hit targets; responsive native modal navigation drawer; Escape/close/backdrop dismissal, scoped scroll locking and desktop resize cleanup. Existing pathname Suspense and content/route ownership are retained. |
| `src/components/layout/account-menu.tsx` | Shared Button with explicit expanded/controlled state, normal Tab order, outside-click/focus departure/Escape dismissal and focus return. Its action panel stays mounted, preserving the original sign-out control's pending/error state. No fake profile/settings/team links. |
| `src/components/projects/project-editor.tsx`, `project-delete-dialog.tsx` | Reuse shared fields/error messages and modal focus boundaries. Original save/delete request handlers, API error text, submit guards, pending Escape restrictions and confirmation consequences are unchanged. |
| `src/app/(dashboard)/error.tsx` | Uses the shared error-status presentation; safe fixed error text and retry behavior are unchanged. |

The mobile drawer controls only navigation UI. It does not move/remount the CSV workspace, alter step keys or modify browser history. Its scroll lock restores the prior inline value on close/unmount, and changing to the desktop breakpoint closes the drawer and focuses the real active sidebar destination. The account disclosure is a collection of normal controls, not an ARIA application menu requiring a different keyboard model.

## Verification — actual final results

| Check | Result |
| --- | --- |
| Full `npm.cmd test -- --maxWorkers=1` | **1,643 passed**, 139 files, 128.50s, no skipped tests reported. |
| Independent `npx.cmd tsx --test tests/engine.test.mjs` | **5 passed**, exit 0. |
| Focused production Chromium, 14 spec files | **140 passed in one execution**, 377.006s (6.3m), 0 failures/skips/flaky cases/retries. JSON confirms 140 first attempts. |
| Additional real drawer-route selection | **1 passed**, 10.5s, zero retries. All four existing destinations are followed through actual anonymous server redirects to `/login`, with no leaked scroll lock. This is not a real authenticated-account test. |
| New drawer/account/dialog matrix | All **15 new cases** passed both in the corrected smoke run and inside the 140-case run. Covers six widths × light/dark, resize, cancelled CSV departure/drafts and sign-out error preservation/retry. |
| `npx.cmd tsc --noEmit --incremental false` | Passed, exit 0, including final test source. |
| `npm.cmd run lint` | Passed, 0 errors; existing unused `samplePath` warning remains at `tests/e2e/release-privacy.auth.spec.ts:3`. |
| `npm.cmd run build` | Production compilation/TypeScript/route generation passed on unchanged retries after the existing Next.js security advisory gate. Latest source build: `build-focus-retry.log`. No warning suppression or dependency upgrade. |
| `git diff --check` | Passed. |

The broad Chromium selection includes `rowzen-shell`, `layout`, `project-pages`, `design-system`, `loading-states`, `theme`, `theme-workflows`, `workspace-departure`, `guided-workspace`, `route-titles`, `auth-feedback`, `login-continuation`, `history-navigation` and `rowzen-branding` public specs. It runs against the task-owned existing production build on port 3001, one configured worker, explicit `--retries=0`, and line/JSON reporters. The extra `rowzen-shell-routes.public.spec.ts` checks actual protected destination handling separately.

Covered widths: **320, 375, 390, 768, 1024, 1440px**. Theme tests include explicit light/dark, System OS changes, preference persistence, blocked storage, cross-tab updates and hydration. Other checks preserve native form validation, focus restoration, busy/duplicate-submit and Escape behavior, project CRUD/error/retry semantics, query-scoped project links, saved-history return filters, browser Back/departure cancellation, original CSV values, mapping drafts, corrections, Undo/Redo, downloads and sign-out cancellation/failure/success.

## Issues found and resolved

- Chromium did not expose the initial account summary trigger as the expected accessible button. It was replaced with the existing shared native Button and an explicit disclosure state.
- Keyboard checks exposed a modal Tab-boundary gap. A small shared guard now cycles boundary controls while retaining native modal inertness/Escape and each owner's pending-operation rules.
- Existing tests using an unnamed `includeHidden` dialog locator became ambiguous once the always-mounted navigation drawer was present. Selectors now identify the actual named New project/Delete project dialog; pending/cancellation assertions and timeouts remain intact.
- An initial full Vitest run with four workers recorded 1,642 passes and the previously observed 5-second OAuth client-bundle timeout. The final serial run passed all 1,643 tests without changing any assertion or timeout. Early interrupted smoke/broad runs remain in the evidence folder and are not classified as passing runs.

## Preservation evidence

SHA-256 checks verify **127 domain/auth/API/Prisma/package/configuration/preview files unchanged**, including all **17 landing-preview assets/metadata files**. Ten additional protected files—including the original sign-out component, workspace/correction owners, theme selector, logo/icons, root stylesheet/layout and dashboard layout—also match the Phase 1 verified versions. Extracted original project save/delete handler bodies match unchanged source.

No validation, correction, What-if, AI/provider/model, schema descriptor/layout, export adapter, authentication/linking/authorization, API, Prisma, package/lock, environment, route, storage key or deployment behavior was changed. The existing single semantic palette and original Rowzen identity remain. No library was installed and no landing preview was regenerated. The task-owned production server was stopped; the user's dev server was retained.

## Evidence and limitations

Local evidence: `playwright/.cache/rowzen-primitives-shell-20261027/`.

- [Visual review gallery](../playwright/.cache/rowzen-primitives-shell-20261027/gallery.html): 24 screenshots of actual components with explicitly synthetic project data. These are component fixtures, not real authenticated account captures.
- `results-final.json`, `playwright-final.log`, `verification-summary.json`: the single complete 140-case run.
- `routes-final-playwright.log`: actual destination redirects.
- `vitest-final.log`, `engine.log`, `typescript-verified.log`, `lint-verified.log`, `build-focus-retry.log`: final checks.
- `domain-before.json`, `domain-after.json`, `preservation.json`: unchanged boundary evidence.

Real authenticated/two-account browser tests remain **NOT TESTED** without legitimate external session states. The opt-in authenticated layout test has been updated to use the real drawer/account controls. Chromium keyboard/contrast coverage is not full WCAG certification or a Firefox/WebKit claim. Real Google/GitHub consent and real Ollama evaluations were not rerun for this presentation-only task.

The existing **Next.js dependency advisory remains a separate production release blocker**, as documented in [security guidelines](security.md). A successful build/test run does not remediate it. No security upgrade, push, merge or deployment was performed.

## Sign-out and native-zoom regressions — 31 October 2026

The reported full public run had 457 passes and two failures. The retained error contexts showed a missing account error alert and a native-zoom capture expecting light while receiving dark.

- The current sign-out component still used the older console-only error handler. The working `40ce923` version already supplied fixed visible error messages, the shared pending Button, a synchronous submit guard and workspace-departure confirmation. Those client behaviors are restored while retaining the existing Better Auth call and `/login` replacement on success. The account disclosure already keeps its children mounted, so errors now survive dismissal and permit retry. No authentication server, session or ownership logic changed.
- The zoom failure was intermittent: the unmodified zoom test passed in the baseline rerun, while sign-out failed again. Its persistent Chromium profile was shared between runs, and it navigated immediately after selecting a theme without checking the applied preference. The selector was also enabled in server HTML before React could handle changes. A new delayed-JavaScript test reproduced that enabled-before-hydration state. A server-false/client-true external-store snapshot now keeps the select disabled until hydration; the pre-paint theme runtime, storage key, tokens and workspace identity remain unchanged.
- The native-zoom test now uses a per-test output profile and checks the applied and stored theme before navigation. It still uses actual Chromium 200%/400% zoom, with the original viewport, DPR, scale, overflow, focus, draft-value and DOM-identity assertions and timeout. No assertion was removed or tolerance enlarged.

New browser regressions cover delayed hydration followed by immediate theme navigation, duplicate pending sign-out requests/network failure/retry, and cancelled sign-out retaining CSV/mapping drafts without a request. The original reported tests remain in place. Requirements and the theme data flow are updated in `SRS.md` and `architecture.md`.

Actual checks for this restoration:

| Check | Result |
| --- | --- |
| Baseline reported-test selection | Sign-out failed again; unmodified zoom passed (1 failed, 1 passed). |
| Delayed-hydration regression before fix | Failed: the server-rendered selector was enabled while client scripts were held. |
| Focused fixed tests against the existing dev server | Both reported tests plus delayed hydration: **3 passed**, 56.6s. |
| `npm.cmd test` | **748 passed**, 85 files, 7.79s. |
| `npx.cmd tsc --noEmit --incremental false` | Passed, exit 0. |
| `npm.cmd run lint` | Passed, zero errors; existing warnings for generated `coverage/block-navigation.js` and unused `samplePath` remain. |
| `npm.cmd run build` | Passed; compilation, TypeScript and all 15 static pages generated. |
| Related production Chromium regression | **61 passed**, 3.7m, one worker, zero retries. Includes both original failures and all three added cases. |
| `git diff --check` | Passed. |

Production selection: `rowzen-shell.public.spec.ts`, `rowzen-final-states.public.spec.ts`, `theme.public.spec.ts` and `theme-workflows.public.spec.ts`, with `PLAYWRIGHT_BASE_URL=http://localhost:3001`, `PLAYWRIGHT_USE_EXISTING_SERVER=1`, `--project=public-chromium --retries=0 --reporter=line --output=playwright/.cache/e2e-regressions-20261031/production`. Baseline/focused outputs remain beside that directory. The zoom JSON records **68 captures**, 34 per theme, factors 2 and 4, maximum horizontal overflow **0**, and all four draft/DOM-node checks retained. A representative actual 400% light workspace capture was visually inspected.

The complete 459-case public suite was not rerun; these are the actual affected-suite results. Sign-out responses and signed-in shell content use synthetic fixtures, not real-account session attestation. No authentication backend, package, schema, secrets or ownership checks changed. Earlier projects-restoration work and pre-existing generated-file edits were retained. The task-owned production server was stopped; the existing dev server was retained. No commit, push or deployment was performed.
