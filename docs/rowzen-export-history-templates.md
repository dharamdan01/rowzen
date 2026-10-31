# Rowzen: Export, saved reports, history and templates

Date: 27 October 2026 (Asia/Karachi).

## Implemented formats and boundaries

| Existing artifact | Scope |
| --- | --- |
| Corrected CSV | Approved current source records; original headers/order; disclosed spreadsheet-formula apostrophe prefix. |
| Full report JSON | Full report including explanations/configuration metadata; review sensitive prose before sharing. |
| Privacy-safe JSON, issues CSV, dataset summary CSV | Existing allowlisted validation metadata; names/locations can still be sensitive. |
| Schema SVG | Complete current configured diagram, full canvas, resolved theme and relevant draft warnings; no CSV values. |
| PostgreSQL schema SQL / manifest | Explicit PostgreSQL choices and supported constraints; schema-only default. |
| PostgreSQL restore SQL / data manifest / instructions | Separate consented current records, reversible hex encoding, no automatic execution. |
| MySQL schema/restore SQL / manifest / instructions | Separate MySQL adapter/profile, permitted constraints and native semantics; restore records require consent. |
| MongoDB definitions / JSONL / manifest / instructions | Separate document adapter, optional validators/indexes, explicit types/empty policies; relational FK enforcement NONE. |
| GraphQL SDL | Not implemented as an artifact/UI; shared compatibility contracts alone do not create an exporter. No GraphQL database marketing/control added. |
| PNG | Deferred; no new format enabled. |

File generation, parseable JSON/XML and local validation are not proof of real database import success. SQL/MongoDB files remain inert downloads until a user independently chooses to use official tooling.

## Presentation changes

- Export explains the difference between corrected records, metadata and target-specific files. Full report explanations are separate from privacy-safe report downloads.
- Each database adapter retains its own options/serializers. Type-choice disclosures and code previews share restrained surfaces and horizontally scrollable readable column controls.
- Schema/metadata-first defaults and sensitive record opt-in are clearer. Compatibility, empty/null policies, MySQL non-atomic DDL, reversible hex and MongoDB FK/index limitations remain present.
- Existing preparation/download/cancellation errors and status messages use consistent semantic surfaces. No warning, constraint, choice or record is silently removed.
- Mapping templates distinguish saving current settings from reusing saved settings. Ownership/project scope, capacity, pending/error/empty state, compatibility checks and confirmation remain unchanged.
- Saved report metadata/date context remains explicit. History retains native search/status/date/page-size filters, scoped return links and pagination, with a bounded keyboard-scrollable table containing every displayed row.

## Files changed

| File | Presentation change |
| --- | --- |
| src/components/upload/upload-workspace.tsx | Export guidance, full-report heading and disclosure readability only. |
| src/components/database-export/postgresql-schema-export.tsx | Schema-first context, grouped choices, readable preview/options/status. |
| src/components/database-export/postgresql-data-export.tsx | Sensitive-record consent and instruction/error presentation. |
| src/components/database-export/mysql-export.tsx | Native choices, optional-record heading/consent and preview/status presentation. |
| src/components/database-export/mongodb-export.tsx | Document choices, explicit optional-record context and preview/status presentation. |
| src/components/reports/report-export-controls.tsx | Distinct metadata exports and readable disclosure. |
| src/components/corrections/corrected-csv-export-controls.tsx | Grouped existing record selector/download action. |
| src/components/templates/mapping-template-controls.tsx | Save/reuse headings over existing controls. |
| src/components/reports/history-results.tsx | Bounded existing table region; all rows and links retained. |
| src/components/reports/saved-summary.tsx | Recorded-date presentation only. |
| tests/e2e/rowzen-exports.public.spec.ts | Actual supplied-pack artifact bytes, consent, reuse/save retry, history density and System state retention. |
| docs/PRD.md; docs/SRS.md; docs/architecture.md; docs/security.md | Scope, acceptance, privacy and ownership limits. |

## Actual verification

Evidence: playwright/.cache/rowzen-exports-20261027.

- Before edits: **319 unit/integration tests / 25 files passed**.
- Same focused suite after UI edits: **319 / 25 passed**.
- Expanded relevant regression: **519 tests / 40 files passed**, 6.00 seconds. Includes database serializers/foundation/session, template APIs, report/history/summary services, summary-create API, ownership contracts and workspace integrations.
- TypeScript: npx.cmd tsc --noEmit passed.
- ESLint: npm.cmd run lint passed with zero errors and the existing unused samplePath warning in tests/e2e/release-privacy.auth.spec.ts:3.
- Production build: npm.cmd run build passed (explicit exit 0) after the existing security reminder stopped the first attempt with exit 1 and an identical retry. Both logs retained; no upgrade/suppression/configuration change.
- Initial browser smoke: **3/3 passed**, including actual artifact files and template/summary retry at 320px.
- Complete focused browser execution: **114/114 passed**, 462.468 seconds, zero failures/skips/flaky cases/retries across ten spec files.
- [Visual gallery](../playwright/.cache/rowzen-exports-20261027/gallery.html): 14 screenshots (six widths, Light/Dark, plus bounded history). System behavior is separately exercised.
- Final protection check: all 170 files unchanged.

## Supplied-pack/file checks

New scenarios use the unchanged samples/csv_fixtures/06_export/escaping_unicode.csv. An explicit manual one-cell correction creates a known current value; original records remain intact.

- Corrected CSV reparses with approved multiline text, unchanged Unicode in other cells, leading-zero postal strings and original headers. Formula-like text is deliberately apostrophe-prefixed as disclosed.
- PostgreSQL and MySQL schema downloads contain supported declared schema/PKs and no record inserts by default. Separate record consent prepares restores containing the exact raw value bytes as dialect-specific hex, including =2+2 without the CSV apostrophe transformation.
- MongoDB JSONL reparses to four exact current documents, preserving strings, whitespace, newlines/Unicode and formula-like text. Manifests explicitly retain foreignKeyEnforcement NONE.
- Schema/data manifests are actual downloaded JSON and distinguish containsRecords false/true, target and NOT_EXECUTED. Instructions retain target-specific tooling flags and limits.
- Actual SVG downloads parse and contain all five configured columns, no active-content nodes and no corrected row values.
- Template load cancellation preserves settings; confirmed reuse restores metadata without altering corrections/history. Summary-save failure does not expose a saved link; retry sends the same metadata-only counts and accepts the returned identifier.
- History tests cover full displayed rows, scoped next/return links and keyboard scrolling; existing suites cover loading/error/retry/empty and pagination semantics.

These checks validate current files and API contracts, not a real authenticated persistence/import environment.

## Preservation

- 170 protected files include all src/lib serializers/contracts/services, app/API/auth routes, Prisma, package/lockfile, supplied CSV files, the existing stepper/shared primitives and correction/AI-planner owners.
- AST comparison: all **283 non-render functions** and component setup/state/lifecycle statements are unchanged across ten modified view files. This includes dialect download/freshness/consent/session handling and save/load methods.
- Existing component keys/order/state ownership remain. No database serializer, Prisma schema, API, auth policy, validation, correction algorithm or AI behavior is rewritten.
- No new dependency, persistence, automatic import/connection or remote record transmission. Unrelated working-tree changes and sample removals were preserved. No push/merge/deploy or landing-preview regeneration.

## Limits and release gates

- Genuine authenticated saved-summary persistence, real authorized/two-account E2E remain NOT TESTED: legitimate external session-state paths were not provided. Summary-create/list/detail and ownership contracts use mocked auth/Prisma; public browser responses are controlled fixtures. They do not prove a real database commit or independent-account isolation.
- No fresh disposable PostgreSQL/MySQL/MongoDB imports were executed for this visual task. Download/XML/JSONL checks and serializer tests do not establish mongoimport or SQL import compatibility. Existing adapter limits remain; UI says database compatibility NOT VERIFIED.
- No real Ollama inference was needed. Deterministic export tests include offline/no-model cases; provider configuration is unchanged.
- Browser verification is Chromium at 320/375/390/768/1024/1440px with Light/Dark/System coverage, not cross-browser/screen-reader certification.
- Results are relevant regression suites, not the entire unrelated application suite.
- The existing Next.js advisory remains a separate production release blocker despite a successful build.

## Browser execution and actual coverage

```powershell
$env:PLAYWRIGHT_BASE_URL='http://localhost:3001'
$env:PLAYWRIGHT_USE_EXISTING_SERVER='1'
$env:PLAYWRIGHT_JSON_OUTPUT_FILE='playwright/.cache/rowzen-exports-20261027/results-final.json'
npx.cmd playwright test tests/e2e/rowzen-exports.public.spec.ts tests/e2e/postgresql-schema.public.spec.ts tests/e2e/mysql-export.public.spec.ts tests/e2e/mongodb-export.public.spec.ts tests/e2e/schema-diagram.public.spec.ts tests/e2e/results-presentation.public.spec.ts tests/e2e/history-navigation.public.spec.ts tests/e2e/template-loading.public.spec.ts tests/e2e/guided-workspace.public.spec.ts tests/e2e/workspace-verification.public.spec.ts --project=public-chromium --workers=1 --reporter=list,json
```

| Spec | Passed |
| --- | --- |
| guided-workspace.public.spec.ts | 13 |
| history-navigation.public.spec.ts | 2 |
| mongodb-export.public.spec.ts | 6 |
| mysql-export.public.spec.ts | 8 |
| postgresql-schema.public.spec.ts | 13 |
| results-presentation.public.spec.ts | 13 |
| rowzen-exports.public.spec.ts | 19 |
| schema-diagram.public.spec.ts | 30 |
| template-loading.public.spec.ts | 2 |
| workspace-verification.public.spec.ts | 8 |

The execution covers actual record/schema/metadata file downloads; SQL/MongoDB consent/default distinctions; target-specific empty/null/Unicode/encoding behavior; current corrected snapshots, Undo/Redo and stale request refusal; malicious identifiers and SVG labels; schema composite/parallel FK completeness; Blob cleanup/error retry; complete offline generation without Ollama; history filtering/return/pagination; template load/error/retry and reuse; save-summary failure/retry metadata payloads; and the existing six-step correction/export workflow.

Expanded regression command:

```powershell
npm.cmd run test -- tests/ui/report-export-controls.test.tsx tests/ui/corrected-csv-export-controls.test.tsx tests/ui/postgresql-schema-export.test.tsx tests/ui/postgresql-data-export.test.tsx tests/ui/mysql-export.test.tsx tests/ui/mongodb-export.test.tsx tests/ui/mapping-template-controls.test.tsx tests/ui/history-results.test.ts tests/unit/database-export tests/unit/templates tests/unit/reports tests/unit/schema-diagram tests/unit/corrections/export.test.ts tests/integration/database-export-session.test.ts tests/integration/templates tests/integration/reports tests/integration/rehearsal/runs-api.integration.test.ts tests/integration/projects-api.test.ts tests/integration/release-route-ownership.integration.test.ts tests/integration/corrections/export.integration.test.ts tests/integration/postgresql-workspace.test.tsx tests/integration/schema-diagram-workspace.test.tsx
```

Evidence files: verification-summary.json, results-final.json, handler-preservation.json, protected-before.json/protected-after.json, vitest-baseline.log, vitest-focused.log, vitest-regression.log, playwright-smoke.log, playwright-final.log, typescript-final.log, lint-final.log, build-initial.log and build-verified.log.

The task-owned production test server on port 3001 was stopped after verification. No command was issued to stop the user's development server on port 3000. Product code was unchanged after the successful build; subsequent changes were tests/documentation only. This presentation verification is complete within the disclosed fixture scope; real authenticated persistence/import and production release gates remain separate.
