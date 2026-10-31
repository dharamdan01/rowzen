# Rowzen: Validate, Review and Results refinement

Date: 27 October 2026 (Asia/Karachi).

## Scope and delivered presentation

- Validate shows its configured-check scope and real completed outcome without invented progress, automatic inference or database execution claims. The current synchronous validation callback remains unchanged.
- Review retains the existing section selector and mounted content. Readiness and summary counts use the same canonical analytics, preserve null as Not evaluated, and distinguish issues from invalid records.
- Issue filters share a compact surface. Search has more desktop space; sorting/page-size disclosure, reset and pagination semantics remain intact. The existing focusable desktop table region has bounded vertical scrolling while mobile keeps the existing list alternative.
- Readiness action lists use a two-column desktop layout while preserving their ordered priorities, complete text and exact counts.
- Analytics retains exact dataset/distribution data and the existing accessible chart table; no fake charts or new metrics are introduced.
- Results history keeps its real project/status/date filters and scoped links. Saved detail explicitly labels its historical summary-only provenance. Neither page claims to restore raw CSV, individual findings or correction history.
- Root-Cause/Impact stays optional. Verified findings are visually distinct from AI hypotheses and potential downstream dataset impact. Requests, privacy consent, evidence resolution, failure handling and issue/cell navigation remain unchanged.
- Dependencies and Schema Diagram controls use the existing semantic surfaces and clearer selection states. Keyboard zoom/pan, fit/reset, inspector, complete textual alternatives and retained camera remain.
- Schema download remains **standalone SVG only**. PNG was not implemented in the existing product and remains deferred. Styling does not add or weaken an export path.

## Files changed

| File | Presentation change |
| --- | --- |
| src/components/upload/rehearsal-execution.tsx | Real configured-check context and grouped execution status. |
| src/components/reports/report-analytics-dashboard.tsx | Readiness hierarchy and report provenance. |
| src/components/reports/summary-cards.tsx | Neutral metric surface, alignment and readable caveat. |
| src/components/reports/issue-explorer.tsx | Grouped filters, density, bounded desktop region and pagination divider. |
| src/components/reports/readiness-insights-panel.tsx | Ordered responsive action layout. |
| src/components/reports/dataset-analytics-table.tsx | Readable explanatory text and numeric alignment. |
| src/components/reports/history-results.tsx | Historical-run context and grouped existing filters. |
| src/components/reports/saved-summary.tsx | Explicit historical metadata scope and metric grouping. |
| src/components/ai/root-cause-analyzer.tsx | Distinct verified findings, hypotheses and potential-impact presentation. |
| src/components/validation/dependency-graph.tsx | Existing control/legend styling only. |
| src/components/validation/dependency-graph-section.tsx | Consistent graph container. |
| src/components/schema-diagram/schema-diagram.tsx | Selected mode styling and grouped existing controls. |
| src/components/schema-diagram/schema-diagram-section.tsx | Dedicated schema-view surface. |
| src/components/schema-diagram/schema-diagram-export-controls.tsx | Responsive existing SVG action and export disclosure. |
| tests/fixtures/review-csv-pack.ts | Canonical test configuration for actual relationship pack files. |
| tests/integration/review-csv-pack.test.tsx | Counts, CONFIG_ERROR, ordered composites, parallel FKs, SVG and snapshot checks. |
| tests/e2e/rowzen-review.public.spec.ts | Supplied-pack browser workflows and actual file checks. |
| docs/PRD.md; docs/SRS.md; docs/architecture.md; docs/security.md | Scope, acceptance and privacy boundaries. |

## Actual supplied-pack scenarios

Inputs are the unchanged bytes in samples/csv_fixtures. Existing configuredPack helpers cover clean/blocked inputs; new relationship helpers explicitly configure declared keys and FKs rather than inferring them.

| Input/configuration | Actual deterministic outcome |
| --- | --- |
| Four clean files, approved configured rules | READY; 14 total/14 valid/0 invalid records, no findings. |
| students_issues + departments_parent | BLOCKED; 7 total/4 valid/3 invalid records, 9 findings. |
| parent_composite + child_composite_valid | READY; 6 total/0 invalid records; one FK with two ordered pairs. |
| parent_composite + child_composite_invalid | BLOCKED; 5 total/1 invalid record; both declared FK components remain present. |
| addresses + orders_two_fks | READY; 5 total/0 invalid records; billing and shipping remain separate FK declarations. |
| cycle_a + cycle_b | BLOCKED; 4 total/0 invalid data rows; cycle dependency findings remain separate from row validity. |
| Parallel fixture with missing parent endpoint | CONFIG_ERROR; valid/invalid rows remain null/Not evaluated. |

Tests verify that schema generation does not mutate datasets, all configured pair identities remain in layout/export, and exported schema excludes distinctive row values. In the UI, deterministic counts remain identical through filtering, section navigation, offline AI attempts and schema inspection.

## Verification results

Evidence directory: playwright/.cache/rowzen-review-20261027.

- Before edits: **225 tests / 16 files passed**.
- Focused after changes: **231 tests / 17 files passed**. A new SVG test initially counted decorative paths; it was corrected to inspect only actual marker-end relationship paths. Product serialization was not changed.
- Expanded relevant Vitest regression: **988 tests / 68 files passed**, 6.53 seconds. Includes report/rehearsal, schema, AI and correction unit/integration coverage.
- TypeScript: npx.cmd tsc --noEmit passed (exit 0).
- ESLint: npm.cmd run lint passed (exit 0), zero errors and the existing unused samplePath warning in tests/e2e/release-privacy.auth.spec.ts:3.
- Production build: npm.cmd run build passed (explicit exit 0) after the existing security reminder's initial exit 1 and identical retry. Logs retain both outcomes; no upgrade or security suppression occurred.
- First browser smoke: four cases passed, including blocked metrics/filter retention, CONFIG_ERROR, offline focused explanation with real record navigation, and composite SVG download.
- Complete focused browser execution: **128/128 passed**, 457.576 seconds, zero failures/skips/flaky cases/retries across nine spec files.
- [Visual gallery](../playwright/.cache/rowzen-review-20261027/gallery.html): 34 actual supplied-pack screenshots. Schema captures retain the exercised zoom/pan; exported files were independently verified as complete.
- git diff --check: passed.

## Preservation and privacy

- Before/after hashes cover 171 protected files: libraries/domain logic, all app routes, API/auth/Prisma, package/lockfile, supplied CSVs, unchanged workspace/stepper/shared primitives and diagram viewport/layout helpers.
- TypeScript AST comparison covers 14 modified view files and 115 non-render functions. Handler bodies and component setup/state/lifecycle statements are unchanged.
- New browser tests exercise the real parser, template compatibility/approval, canonical validation and real components with controlled synthetic project/template API responses. They do not bypass authentication in the actual app or prove real account ownership.
- No new dependency, endpoint, storage, raw-record upload, database connection/execution or automatic change was introduced. Existing unrelated working-tree changes and removed sample files were preserved. Nothing was pushed, merged or deployed; landing preview assets were not regenerated.

## Limits and release blockers

- Genuine authenticated/two-account E2E is NOT TESTED without legitimate external session-state files. Existing owner-checked routes were preserved; synthetic component fixtures are not equivalent to authorized server sessions.
- Offline tests use controlled connection refusal; existing actual browser-offline SVG tests run separately. No real Ollama quality benchmark or physical service shutdown is claimed for this UI task.
- PNG remains deferred; only implemented SVG download behavior is verified. No new export format is enabled.
- Responsive/theme/keyboard coverage is Chromium, including 320/375/390/768/1024/1440px, Light/Dark/System. This is not a cross-browser or screen-reader certification.
- Full application Vitest and the entire unrelated Playwright suite were not requested/run; results above are relevant regression suites.
- The installed Next.js security advisory remains a separate production release blocker despite a successful build. No upgrade/suppression is included.

## Browser command and exact coverage

```powershell
$env:PLAYWRIGHT_BASE_URL='http://localhost:3001'
$env:PLAYWRIGHT_USE_EXISTING_SERVER='1'
$env:PLAYWRIGHT_JSON_OUTPUT_FILE='playwright/.cache/rowzen-review-20261027/results-final.json'
npx.cmd playwright test tests/e2e/rowzen-review.public.spec.ts tests/e2e/rehearsal-execution.public.spec.ts tests/e2e/results-presentation.public.spec.ts tests/e2e/issue-navigation.public.spec.ts tests/e2e/dependency-graph.public.spec.ts tests/e2e/schema-diagram.public.spec.ts tests/e2e/ai-root-cause.public.spec.ts tests/e2e/guided-workspace.public.spec.ts tests/e2e/configuration-errors.public.spec.ts --project=public-chromium --workers=1 --reporter=list,json
```

| Spec | Passed |
| --- | --- |
| ai-root-cause.public.spec.ts | 23 |
| configuration-errors.public.spec.ts | 2 |
| dependency-graph.public.spec.ts | 11 |
| guided-workspace.public.spec.ts | 13 |
| issue-navigation.public.spec.ts | 3 |
| rehearsal-execution.public.spec.ts | 6 |
| results-presentation.public.spec.ts | 13 |
| rowzen-review.public.spec.ts | 27 |
| schema-diagram.public.spec.ts | 30 |

The run verifies real deterministic counts and null semantics; saved-summary metadata limits and scoped history navigation; filters/sorting/page sizing/pagination; physical mapped record navigation; optional grounded AI citations and potential-impact limits; offline/malformed/cancelled/stale AI requests; correction/history/Undo/Redo; composite/parallel/cycle diagrams; keyboard/pointer camera controls and System themes; current full-canvas SVG downloads; hostile-label safety; stale export invalidation; error privacy/retry/Blob cleanup; and fully browser-offline generation/export without Ollama.

Main expanded Vitest command:

```powershell
npm.cmd run test -- tests/ui/report-analytics-dashboard.test.tsx tests/ui/rehearsal-execution.test.tsx tests/ui/readiness-insights.test.tsx tests/ui/dependency-graph.test.tsx tests/ui/schema-diagram.test.tsx tests/ui/root-cause-analyzer.test.tsx tests/unit/reports tests/unit/schema-diagram tests/unit/ai tests/unit/corrections tests/unit/rehearsal tests/integration/review-csv-pack.test.tsx tests/integration/reports tests/integration/schema-diagram-workspace.test.tsx tests/integration/root-cause-provider.test.ts tests/integration/corrections
```

Machine-readable results: verification-summary.json and results-final.json. Logs: vitest-baseline.log, vitest-focused.log (initial new-test path-count mistake retained), vitest-focused-verified.log, vitest-regression.log, playwright-smoke.log, playwright-final.log, typescript-final.log, lint-final.log, build-initial.log and build-verified.log. Hash/AST preservation results are alongside these logs.

The task-owned production test server on port 3001 was stopped after verification. No command was issued to stop the user's development server on port 3000. No code changes followed the successful production build; subsequent edits were test/documentation only. This focused presentation verification is complete within the disclosed fixture scope; it does not clear independent production release blockers.
