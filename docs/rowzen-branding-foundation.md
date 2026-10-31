# Rowzen branding and theme foundation

Implemented 27 October 2026 (Asia/Karachi), following the approved audit and `ROWZEN_UI_GUIDE.md`. This is the branding/theme foundation only; subsequent layout, navigation and workflow redesign phases have not started.

## Changes

- Public landing, login, demo and authenticated-shell wordmarks use **Rowzen** and an original row/grid/check SVG. The shared wordmark has a visible text name and a decorative, non-focusable mark; a standalone icon can have its own accessible name.
- Root/application metadata and page title templates use Rowzen. The landing footer uses the approved “Clean data. Confident imports.” tagline. Existing descriptions remain factual preflight language; no metrics or new capabilities were introduced.
- Human-readable PostgreSQL/MySQL SQL comment headers and PostgreSQL import guidance use Rowzen. The statements, value encoders, import commands, manifests and existing `datarehearsal-*` filenames retain their contracts.
- `src/app/icon.svg` and the regenerated 32px PNG-backed `favicon.ico` use the original mark. Both are local, active-content-free assets. The existing `/favicon.ico` route is preserved.
- `src/lib/theme/tokens.ts` is the single semantic light/dark color source. It supplies neutral surfaces, sidebar, indigo actions/focus, strong control borders and semantic status colors. Existing `--danger` naming is retained; no competing token scheme or new theme preference is added.
- `src/app/layout.tsx` emits the trusted static token stylesheet before the unchanged theme initializer. Tailwind v4's existing `@theme inline` aliases consume its CSS variables. Standalone schema SVG export and dependency-graph fallback colors use the same palette. SVG geometry, relationships, escaping, download contracts and deterministic algorithms are unchanged.
- Existing Geist Sans, technical-font fallbacks, primitives, spacing/radius scales and all component state owners are reused. No dependency, framework upgrade, font download requirement or new product feature was added.

## Boundaries preserved

Internal `data-rehearsal` package identity, `datarehearsal-theme` preference key, event names, artifact filenames, API paths and payloads, Prisma models/migrations, user/project/report/template identities, environment names, Google/GitHub provider IDs, callback URLs, session/linking/authorization policies and Vercel configuration are unchanged. Authentication edits are branding markup/text only; request and linking handlers are untouched.

CSV parsing, validation, AI contracts/provider/model settings, single-cell corrections, What-if, Undo/Redo, history, schema descriptor/layout and database dialect serializers are unchanged. No CSV data is newly transmitted or persisted. The existing pre-paint initialization, storage failure handling, cross-tab synchronization and System preference behavior are retained.

## Verification

Results and ignored screenshots/logs are in `playwright/.cache/rowzen-foundation-20261027/`.

| Check | Actual result |
| --- | --- |
| Focused Vitest: theme, brand, schema descriptor/layout/SVG/export, layout and OAuth/security | 166 passed, 11 files. |
| Full `npm.cmd test -- --maxWorkers=4` | 1,637 passed, 138 files, no skips reported. Both full runs passed; final run after the export-prose update took 45.95s. Uses the concurrency setting that passed the approved baseline, retaining all assertions/timeouts. |
| Independent `npx.cmd tsx --test tests/engine.test.mjs` | 5 passed. |
| TypeScript `npx.cmd tsc --noEmit --incremental false` | Passed, exit 0. |
| ESLint `npm.cmd run lint` | Passed with 0 errors and the existing unused `samplePath` warning in `tests/e2e/release-privacy.auth.spec.ts:3`. |
| Final focused production Chromium, 12 public spec files / 120 cases | **120 passed in one execution**, exit 0, 271.702s (4.5m), 1 worker, 120 first attempts, 0 failures, 0 skipped, 0 flaky, 0 retries. Finalization on 27 October 2026 used unchanged tests/application source and the existing production build. Evidence: `playwright/.cache/rowzen-phase1-final-20261027/results.json` and `playwright.log`. |
| Production build | Passed, exit 0, including the final source build after export wording changes. Both initial build attempts stopped at the existing Next.js security advisory gate; both unchanged retries passed. The upgrade warning remains and was not suppressed. Final log: `build-final-retry.log`. |

Contrast tests retain AA thresholds: normal/status text and primary-button labels at least 4.5:1, control borders/focus at least 3:1; the sidebar is now included. New browser checks cover the Rowzen accessible name, real public titles/application metadata, valid safe SVG/ICO responses, tokens at first body paint, hydration diagnostics, no new browser storage and 320px/desktop overflow. Existing System/OS switching, persistence, blocked storage, cross-tab, OAuth presentation/continuation, shell keyboard and landing tests remain intact. Only deliberate visible-brand and SVG-palette expectations were updated.

Earlier dev-server verification recorded 56/58 passes: one initial route-load timeout and one obsolete primitive-color expectation. A supplemental workspace run was interrupted when obsolete dark-SVG color expectations were found. The first production selection recorded 116/120 passes; four obsolete SVG background expectations were corrected and the affected 30-test schema file passed separately. These historical outcomes remain in `playwright/.cache/rowzen-foundation-20261027/` and are not relabeled as passing full runs. The final 120-case execution above now provides a single complete pass with no further test changes. It includes all twelve Light/Dark workspace workflows at 320, 375, 390, 768, 1024 and 1440px, graph contrast, corrections, Undo/Redo, export content, storage/network boundaries, XML safety, full bounds, parallel/composite FKs, fresh snapshots, Blob cleanup, offline/Ollama-independent operation and System-theme assertions.

## Phase 1 finalization: independent review package

[Download the visual-review ZIP](../playwright/.cache/rowzen-phase1-final-20261027/rowzen-phase-1-visual-review.zip). Extract it first, then open `gallery.html` in a browser. The archive contains exactly 13 root entries: the existing gallery and all 12 referenced screenshots. Its size is 734,397 bytes; SHA-256 is `D88E3F9EE252F48A08F30D5E8C055D92E3EB7E93D5BEB9B9B4AB758BA459C218`.

Each ZIP entry was compared byte-for-byte by SHA-256 with its source at packaging time. The extracted archive was opened in Chromium offline: all 12 images decoded and no remote requests occurred. The ZIP was created before the test rerun and its checksum remained unchanged afterward. It contains no test logs, credentials or session states.

The single complete rerun used the same twelve spec files listed below, `public-chromium`, one configured worker, the existing production build at `http://localhost:3001`, explicit `--retries=0`, unchanged assertions/timeouts, and `line,json` reporters. No per-case reruns were used to produce the 120/120 result.

```text
npm.cmd run test:e2e -- tests/e2e/rowzen-branding.public.spec.ts tests/e2e/theme.public.spec.ts tests/e2e/route-titles.public.spec.ts tests/e2e/oauth-login.public.spec.ts tests/e2e/login-continuation.public.spec.ts tests/e2e/layout.public.spec.ts tests/e2e/design-system.public.spec.ts tests/e2e/landing.public.spec.ts tests/e2e/theme-workflows.public.spec.ts tests/e2e/schema-diagram.public.spec.ts tests/e2e/dependency-graph.public.spec.ts tests/e2e/upload-presentation.public.spec.ts --project=public-chromium --retries=0 --reporter=line,json --output=playwright/.cache/rowzen-phase1-final-20261027/e2e-output
```

Process-only environment: `PLAYWRIGHT_USE_EXISTING_SERVER=1`, `PLAYWRIGHT_BASE_URL=http://localhost:3001`, and `PLAYWRIGHT_JSON_OUTPUT_NAME` pointing to the evidence folder's `results.json`. No environment file or product configuration was changed.

Before/after SHA-256 manifests verify all 430 protected source, test, package/configuration, Prisma and preview files are unchanged. This includes all 17 tracked `public/landing/` preview assets/metadata files: landing previews were not regenerated. The semantic token system, original logo, OAuth and application behavior were not redesigned or refactored. Only documentation and ignored verification/review artifacts changed during finalization. The task-owned production server was stopped; the user's dev server was retained.

Evidence folder: `playwright/.cache/rowzen-phase1-final-20261027/`. Machine-readable records include `results.json`, `verification-summary.json`, `source-before.json`, `source-after.json`, `zip-verification.json` and `gallery-offline.json`.

## Separate production release blocker

The installed Next.js 16.4.0 advisory remains unresolved. The [official 14 October 2026 update](https://nextjs.org/blog/nextjs-security-update-october-14-2026) identifies 16.4.1 as patched; Cache Components is enabled here. The successful Phase 1 test run does not clear this dependency-security blocker. A separately scoped security upgrade and regression verification are required before production release. No upgrade, workaround or advisory suppression was performed. See [security guidelines](security.md).

## Diff scope

35 files: 16 application/asset files, 13 test files and 6 documentation files. The pre-existing untracked guide is excluded. Application changes are root CSS/layout, landing/login/demo copy, shared wordmarks, the original SVG/ICO assets, the consolidated palette, dependency/schema color consumption and four export-prose strings. Existing authentication handlers, state owners, parsing/validation/correction/AI algorithms, export encoders, package/lock/config files, API routes and Prisma schema have no behavioral changes. The exact changed-file list is recorded in the ignored `changed-files.json` alongside the logs. No new dependency was installed.

Real provider OAuth round trips, real authenticated/two-account browser sessions, a full accessibility certification and new real-model evaluations are outside this presentation verification. Existing mocked security/OAuth and deterministic integration suites are not represented as real-provider release gates.

The previously recorded Next.js 16.4.0 security advisory remains separate work. No dependency was upgraded or advisory suppressed during this task. Existing sample product screenshots are preserved; their composition is not redesigned in this foundation phase.

No commit, push or deployment was performed.
