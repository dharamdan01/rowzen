# Vercel build repair — 30 October 2026

The local clean-install production build passes. No push, deployment, migration, production connection, secret change or paid service activation was performed.

## Verified causes and changes

1. The committed tree contained literal merge markers in 20 source/test files, including `file-picker.tsx` and root layout, plus four documents. These caused parser failures along the upload import chain shown in the supplied logs. Resolved using the previously verified local source, preserving the Rowzen redesign. Restored missing `UploadCloud`/Geist imports.
2. The partial checkout lacked required presentation/security helper modules, schema-diagram fixtures, landing screenshot metadata and 16 existing sample WebP assets. Restored their original versions and existing AI-showcase CSS. Recovered the missing history navigation helpers and tested URL normalization/foreign-destination rejection. No database queries or authorization policy changed.
3. An isolated build then compiled but stopped on Next.js 16.4.0's security gate. Updated only Next.js and `eslint-config-next` to exact 16.4.3, with matching lockfile dependencies. No bypass was applied. [Maintainer advisory](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr).
4. Build now generates Prisma Client explicitly before Next.js compilation. No schema/migration changes or automatic migration execution. ESLint excludes only generated browser reports/cache directories, not application/tests.
5. Five old UI test assertions now match recovered visible copy/classes while retaining their content/function checks. Authenticated test helpers use actual six-step workspace navigation, including revealing Export; disabled/eligibility checks remain intact. Three new history-navigation regression tests cover bounds, encoded IDs and redirect rejection.

## Actual current verification

Windows, official Node 24.22.1. A fresh disposable directory copied source/config/assets, deliberately excluding `.env*` and `src/generated`. Synthetic build-only configuration selected Groq hosted mode, enabled its production configuration guards and supplied nonfunctional placeholders. No live inference or database connection occurred.

| Command/check | Result |
| --- | --- |
| `npm ci` in fresh directory | PASS |
| `npm run build` there | PASS; Prisma generation, Next.js 16.4.3 compilation, types and prerender complete |
| `npx --no-install tsc --noEmit` | PASS |
| `npm run lint` | PASS: zero errors; existing unused `samplePath` warning in `release-privacy.auth.spec.ts` |
| `npm test -- --maxWorkers=4` | 735 passed; zero failed/skipped; 84 files |
| Production-build Playwright regression | 69 passed; zero failed/skipped/flaky across five selected suites (3.0 minutes) |
| Source/test/docs conflict-marker scan and `git diff --check` | PASS |
| `npm audit --json` | Exit 1: zero critical, four high, one moderate remaining |

Production browser command (PowerShell, dedicated local server started from the isolated build):

```powershell
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:3011'
$env:PLAYWRIGHT_USE_EXISTING_SERVER = '1'
npx --no-install playwright test tests/e2e/hosted-ai.public.spec.ts tests/e2e/upload-presentation.public.spec.ts tests/e2e/rowzen-review.public.spec.ts tests/e2e/rowzen-corrections.public.spec.ts tests/e2e/landing.public.spec.ts --project=public-chromium
```

The remaining audit findings concern `prisma`/`@prisma/config`/`deepmerge-ts`, `mysql2` and `fast-uri` dependency chains. They were not broadly upgraded in this build repair. A passing build is not a security clearance; review these findings separately before release. The Next.js critical finding is absent from the post-fix audit.

Browser checks exercise real production assets and the real anonymous inference API denial; successful hosted responses and workspace project data are controlled synthetic fixtures. They do not establish real authenticated ownership, OAuth callbacks, Groq inference, Redis availability or deployed Vercel behavior. Those remain NOT VERIFIED. No legitimate sessions were manufactured.

Local evidence, ignored by Git: `playwright/.cache/vercel-build-repair/` contains source-before backups, clean-install/build logs, audit JSON and Vitest JSON. Temporary build directories contain synthetic configuration only.

## Manual Vercel steps

1. Review and commit all repair files listed below, including `package-lock.json`, restored helper modules and `public/landing` assets. Commit neither `.env` nor local caches/auth states. Push the reviewed commit yourself.
2. Vercel Project Settings: framework **Next.js**, root directory containing this `package.json`, Node.js **24.x**, install command **`npm ci`**, build command **`npm run build`**. Clear any obsolete `vercel:build` command override: that script does not exist in this checkout. Leave Output Directory at its Next.js default. [Supported Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
3. Preserve the intended Preview/Production-scoped variables from [hosted AI setup](hosted-ai-deployment.md). The canonical HTTPS `BETTER_AUTH_URL`, real database credentials, auth secret and provider credentials remain your configuration; no secret is embedded by this fix. Keep direct migration credentials in the separate migration environment. `prisma generate` in this build succeeds without `DIRECT_URL`.
4. Manually create a new deployment from the new commit; for the first verification, disable the old build cache. Confirm the log shows Prisma generation and **Next.js 16.4.3**.
5. On Preview, verify canonical-domain sign-in and consented AI with genuine credentials, then upload/configure/validate/What-if/explicit correction/Undo/Redo/export. Run real two-account checks before production promotion. Never count fixture checks as deployed AI success.

Rollback to a previously reviewed, patched deployment if needed; do not revert to vulnerable Next.js 16.4.0. Hosted AI may be disabled by selecting `ollama` and setting `AI_HOSTED_ENABLED=false`, followed by a manual rebuild; this does not make Ollama available to visitors without their own supported setup. No database rollback is required by these changes.

## Changed files

- `docs/architecture.md`
- `docs/hosted-ai-deployment.md`
- `docs/PRD.md`
- `docs/security.md`
- `docs/SRS.md`
- `docs/vercel-build-fix.md`
- `eslint.config.mjs`
- `package.json`
- `package-lock.json`
- `public/landing/corrections-dark-desktop.webp`
- `public/landing/corrections-dark-mobile.webp`
- `public/landing/corrections-light-desktop.webp`
- `public/landing/corrections-light-mobile.webp`
- `public/landing/dependencies-dark-desktop.webp`
- `public/landing/dependencies-dark-mobile.webp`
- `public/landing/dependencies-light-desktop.webp`
- `public/landing/dependencies-light-mobile.webp`
- `public/landing/overview-dark-desktop.webp`
- `public/landing/overview-dark-mobile.webp`
- `public/landing/overview-light-desktop.webp`
- `public/landing/overview-light-mobile.webp`
- `public/landing/results-dark-desktop.webp`
- `public/landing/results-dark-mobile.webp`
- `public/landing/results-light-desktop.webp`
- `public/landing/results-light-mobile.webp`
- `public/landing/screenshots.json`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/login/page.tsx`
- `src/app/page.tsx`
- `src/app/rehearsal/page.tsx`
- `src/components/corrections/corrected-csv-export-controls.tsx`
- `src/components/corrections/correction-history.tsx`
- `src/components/corrections/correction-workspace.tsx`
- `src/components/landing/landing.css`
- `src/components/landing/product-screenshot.tsx`
- `src/components/layout/dashboard-nav.tsx`
- `src/components/reports/dataset-analytics-table.tsx`
- `src/components/reports/history-results.tsx`
- `src/components/reports/issue-explorer.tsx`
- `src/components/reports/readiness-insights-panel.tsx`
- `src/components/reports/report-analytics-dashboard.tsx`
- `src/components/reports/report-export-controls.tsx`
- `src/components/reports/report-status.tsx`
- `src/components/reports/summary-cards.tsx`
- `src/components/templates/mapping-template-controls.tsx`
- `src/components/upload/file-picker.tsx`
- `src/components/validation/dependency-graph.tsx`
- `src/components/validation/dependency-graph-layout.ts`
- `src/lib/reports/history-filters.ts`
- `src/lib/security/login-destination.ts`
- `src/lib/security/oauth-feedback.ts`
- `tests/e2e/corrected-export.auth.spec.ts`
- `tests/e2e/helpers.ts`
- `tests/e2e/helpers/refinement-screenshot.ts`
- `tests/fixtures/schema-diagram.ts`
- `tests/ui/correction-workspace.test.tsx`
- `tests/ui/history-results.test.ts`
- `tests/ui/readiness-insights.test.tsx`
- `tests/ui/report-analytics-dashboard.test.tsx`
- `tests/ui/report-export-controls.test.tsx`
- `tests/unit/reports/history-filters.test.ts`
