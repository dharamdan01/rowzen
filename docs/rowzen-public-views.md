# Rowzen public landing and login

Completed 27 October 2026 (Asia/Karachi). Scope: public landing and login presentation only, following Phase 4 of the approved Rowzen guide. No dashboard/workspace redesign, authentication feature or import execution was added.

## Delivered presentation

- Original restrained composition using the existing semantic palette, Geist font, Rowzen mark, primitives and theme selector.
- Clear landing promise: CSV mapping, deterministic preflight checks, issue review/correction, optional AI advice and browser-local exports. Passing configured checks is explicitly distinguished from database compatibility and business correctness.
- Genuine existing sample-run captures, labeled as demo/sample data, with keyboard-operated preview tabs, responsive source images and full-size links. All 17 files under public/landing remain byte-identical; no preview assets were regenerated.
- Real CTA destinations and anchors, including the existing public CSV demo, dashboard continuation and login. No invented pricing, customers, metrics, legal pages or external product domain.
- Desktop split login; compact centered form below 1024px. Stacked GitHub/Google actions, readable account-linking guidance, shared error presentation, session loading, skip link, return link and visible keyboard focus.
- Text-only home description/Open Graph/Twitter metadata and login description. Existing page titles and icon routes are preserved.

## Actual implementation files

| File | Change |
| --- | --- |
| src/app/page.tsx | Landing composition, real capability/privacy copy and page metadata. |
| src/components/landing/landing-header.tsx | Compact 64px header and spacing; existing mobile disclosure/section navigation retained. |
| src/components/landing/landing-links.tsx | CTA weight and reduced-motion-aware hover transition; existing /dashboard target retained. |
| src/components/landing/product-preview.tsx | Contained frame around existing keyboard tabs, screenshots and captions. |
| src/app/login/page.tsx | Local reusable LoginFrame around unchanged session branches; provider layout/decorative monograms and shared error presentation. |
| src/app/login/layout.tsx | Login description; existing server metadata boundary/title retained. |
| tests/ui/landing.test.tsx | Updated intentional headline and added truthful capability/demo/consent assertions. |
| tests/e2e/landing.public.spec.ts | Updated intentional headline; existing layout/transfer/CLS/tab/navigation assertions retained. |
| tests/e2e/rowzen-public.public.spec.ts | 14 new cases covering login loading/layout/focus at six widths and both themes, public metadata/local links, no unexpected writes/external requests and System/cancellation preservation. |

PRD, SRS, architecture and security documentation now record the public-view requirements and boundaries. No new dependency, route, backend endpoint, palette or browser storage key was added.

## Actual test results

| Check | Result |
| --- | --- |
| Baseline focused Vitest before edits | 45 passed, 5 files, 4.91s. |
| Final focused Vitest | **80 passed**, 9 files, 5.94s. |
| Initial landing/new-login Chromium smoke | **27 passed**, 55.4s. |
| Final public Chromium regression, one execution | **97 passed**, 196.308s; 0 failures, skips, flaky cases or retries. JSON verifies 97 first attempts. |
| Separate LIVE Google/GitHub authorization initiation | **2 passed**, 7.241s; existing real server credentials/configuration, no transport fixtures. |
| TypeScript | Passed, exit 0. |
| ESLint | Passed, 0 errors; one existing unused samplePath warning in tests/e2e/release-privacy.auth.spec.ts:3. |
| Production build | Passed after correcting an unavailable lucide export in the initial attempt; compiled in 15.5s, TypeScript in 9.2s, all 14 static pages generated. |
| git diff --check | Passed. |

The initial implementation attempt referenced a GitHub icon absent from the installed lucide version; it was replaced with decorative provider monograms without adding a package. An initial new assertion also exposed a Unicode pipeline transcription error in the test string; the intended label was restored. Early failing logs remain retained. No assertion, timeout, transfer limit, layout-shift threshold or safety check was weakened.

### Commands

Final unit selection:

```text
npm.cmd test -- tests/ui/landing.test.tsx tests/unit/security tests/unit/theme tests/unit/ui-primitives.test.tsx tests/integration/oauth-authentication.test.ts tests/layout.test.tsx --maxWorkers=1
npx.cmd tsc --noEmit --incremental false
npm.cmd run lint
npm.cmd run build
git diff --check
```

Browser command uses npm.cmd run test:e2e, --project=public-chromium --retries=0 --reporter=line,json and the existing production build on localhost:3001, one configured worker. Selected public specs: landing, rowzen-public, oauth-login, auth-feedback, login-continuation, route-titles, rowzen-branding, theme, theme-workflows, design-system, demo-alignment and loading-states.

The separate real initiation run uses the unchanged configured localhost:3000 auth origin, DATAREHEARSAL_REAL_OAUTH_INIT=1, oauth-login.public.spec.ts and --grep '^LIVE'. It checks actual provider authorization URLs, expected callback routes, state, Google PKCE and absence of client_secret in the returned URL. It does not navigate to either provider or exchange an authorization code.

## Preserved behavior and evidence

SHA-256 checks confirm **131 protected files unchanged**, including all src/lib modules, auth APIs, Prisma, package/lock, next.config.ts, root theme/font/layout, original sign-out/theme selector and local preview assets. TypeScript AST extraction confirms the existing startOAuth and pageshow recovery handler text is unchanged. Safe destination, error callback, attempt/duplicate-submit guards, explicit account linking, sign-out and fixed provider feedback still use the existing implementations.

Browser coverage includes 320/375/390/768/1024/1440px, light/dark, System changes/persistence, pre-paint theme/hydration, native focus outlines, provider Tab order, skip-link focus, loading/retry, cancellation, hostile callback hints, safe redirects, explicit linking presentation, restored-page stale-attempt handling, mobile disclosure, preview arrow/Home/End keys, image loading, retained <0.1 CLS and <250KB initial screenshot-transfer budgets, actual local link responses and demo navigation. Shared compiled control contrast checks pass. Representative desktop, tablet and 320px screenshots were visually inspected.

Evidence: playwright/.cache/rowzen-public-20261027/.

- [Visual gallery](../playwright/.cache/rowzen-public-20261027/gallery.html): 24 actual rendered public-view screenshots. Four before captures and two additional loading captures also remain in that directory.
- verification-summary.json, results-final.json and playwright-final.log.
- live-oauth-results.json and live-oauth.log, kept separate from fixtures.
- protected-before.json and auth-handler-preservation.json.
- baseline-vitest.log, vitest-corrected.log, typescript.log, lint.log and build-corrected.log.

The task-owned production server was stopped; the user's existing dev server was retained. Existing uncommitted work was preserved. No commit, push, merge or deploy was performed.

## Limits and release gates

- Complete real Google/GitHub consent, code exchange, new/returning-user login, same-email linking, logout with a genuine session and two-account ownership checks remain **NOT TESTED** in this phase. Real URL initiation and synthetic signed-in presentation are not proof of these flows. No legitimate Playwright session state was available.
- Chromium keyboard/layout/contrast checks are not full WCAG certification or Firefox/WebKit coverage.
- The full Vitest suite and database import round-trips were not rerun for this presentation-only scope; focused tests and the public regression suite above were actually run. Domain serializers/engines and provider configuration are unchanged.
- Existing Next.js security advisory remains a separate production release blocker; this visual change does not remediate or suppress it.
- PNG/GraphQL and other unsupported exports are not newly advertised. No database import is executed.

Phase: landing and authentication. Commit: not committed. Next phase is dashboard/projects only when requested.
