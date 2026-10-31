# Rowzen: Upload and Configure polish

Date: 27 October 2026 (Asia/Karachi).

Scope: existing six-step CSV Workspace, focused on Upload and Configure. No new route, stepper, design system, dependency, backend endpoint or database operation.

## Delivered presentation

- File picker states the actual file count/size/encoding requirements, comma-separated format, nonempty unique headers and need for data rows. Native selection, drag/drop, disabled behavior and selecting the same file again are preserved.
- Failed replacement feedback explicitly confirms retention only when a previous parsed selection exists. Existing parser errors remain verbatim. Files commit together only after every file parses successfully.
- Original preview keeps the first five original records, complete values, headers and physical CSV lines in the same keyboard-focusable table region. Its height is bounded; overflow scrolls inside the region.
- Mapping rows retain complete mobile labels and reduce repeated desktop labels. Unset data types now accurately show **Not configured**, rather than displaying string despite no type rule being configured. The placeholder is disabled; existing valid-type change handling is unchanged.
- Unique keys use the existing shared Textarea. Primary/composite/unique/required/FK controls and all error associations remain.
- Templates display the actual project-scoped count against the existing 20-template capacity only after a successful list response. Loading/error never becomes zero; confirmation, compatibility and mutation behavior remain unchanged.
- Existing deterministic column evidence and template drift are visually separated from optional AI advice. Evidence uses two columns where space allows. AI output remains unverified advice pending local checks and explicit approval; local pattern checks do not establish business correctness.

## Actual files

| File | Change |
| --- | --- |
| src/components/upload/file-picker.tsx | Upload guidance, privacy text and restrained drop-zone styling. |
| src/components/upload/upload-presentation.tsx | Conditional retained-data feedback and bounded original preview. |
| src/components/upload/schema-mapping.tsx | Denser desktop labels and truthful unset-type display. |
| src/components/upload/upload-workspace.tsx | Presentation prop, shared Textarea, visual grouping and relationship guidance only. |
| src/components/templates/mapping-template-controls.tsx | Real capacity count and responsive control grouping. |
| src/components/ai/schema-mapping-assistant.tsx | Evidence/advice hierarchy and responsive evidence list. |
| tests/fixtures/workspace-csv-pack.ts | Reads the supplied pack's exact bytes; canonical configuration helpers for tests. |
| tests/integration/workspace-csv-pack.test.ts | Canonical clean/blocked, drift, upload-error, privacy and snapshot checks. |
| tests/e2e/rowzen-workspace.public.spec.ts | Pack workflows, six widths, themes, mounted drafts, recovery, offline and explicit AI approval. |
| tests/ui/upload-presentation.test.tsx; tests/ui/schema-mapping.test.tsx | Feedback and unset-type assertions. |
| tests/e2e/ai-schema-mapping.public.spec.ts | Existing assertions now expect the truthful unset selection; explicit configured string checks are not relaxed. |
| docs/PRD.md; docs/SRS.md; docs/architecture.md; docs/security.md | Presentation scope and preservation requirements. |

## Supplied-pack results

Source: samples/csv_fixtures. Pack files are never changed.

- Clean: four actual CSVs, explicit configured types/keys/three FKs, enrollment composite PK; canonical READY, 14 total/14 valid/0 invalid rows, zero findings.
- Blocked: actual students_issues and departments_parent with explicit rules/FK; canonical BLOCKED, 7 total/4 valid/3 invalid rows, 9 findings.
- Drift: actual v2 added student_id/semester and removed student_no; v3 removed dept_code; v4 reordered columns. Original incompatible templates remain blocked from loading.
- Drift versions are supplied to the browser as students.csv to represent one logical dataset. Their bytes and disk filenames are unchanged. A separate test verifies that the original differing filenames produce dataset_missing rather than inventing shared identity.
- Seven actual upload-error files are rejected, including invalid UTF-8 and oversize input. Browser tests verify failed replacements preserve prior selected files, PK settings and the identical existing report.
- Leading-zero postal strings, original/corrected snapshots, revalidation and Undo/Redo remain consistent. AI wire metadata excludes pack names/emails/postal values and dataset identity.

## Verification

Evidence directory: playwright/.cache/rowzen-workspace-20261027.

- Baseline: 55 tests, 5 files passed before edits.
- Focused first verification: 105 tests, 10 files passed after correcting a new test's use of the actual Undo/Redo API names.
- Expanded relevant regression: **680 tests, 43 files passed**, 8.33 seconds. Includes AI Foundation/Features 1-3 domain contracts, correction and What-if unit/integration tests, parser, mapping, templates and workspace tests.
- Final browser matrix: **82/82 passed**, 311.366 seconds, zero failures/skips/flaky tests/retries in one execution across eight spec files.
- TypeScript (`npx.cmd tsc --noEmit`): exit 0. ESLint (`npm.cmd run lint`): exit 0, zero errors and one existing unused samplePath warning in tests/e2e/release-privacy.auth.spec.ts:3.
- Production build (`npm.cmd run build`): final explicit process exit **0**. The security reminder first returned exit 1; an identical build retry completed with the advisory still present. Both logs are retained; no upgrade, suppression or configuration change was made.
- git diff --check: passed.
- [Visual review gallery](../playwright/.cache/rowzen-workspace-20261027/gallery.html): 26 supplied-pack screenshots; synthetic component/API fixtures, not real authenticated sessions.

Commands are retained in the corresponding logs. Main Vitest command:

```powershell
npm.cmd run test -- tests/ui/upload-presentation.test.tsx tests/ui/schema-mapping.test.tsx tests/ui/mapping-template-controls.test.tsx tests/integration/workspace-csv-pack.test.ts tests/integration/mapping-commit.test.tsx tests/unit/ai tests/unit/corrections tests/integration/corrections tests/unit/templates tests/unit/rehearsal/workspace-config.test.ts tests/parser.test.ts tests/mapping.test.ts tests/unit/workspace-steps.test.ts
```

## Preservation evidence

- 149 protected files hashed before/after: all unchanged. Includes src/lib, API routes, Prisma, package/lockfile, the original stepper, shared primitives, global styling/layout and the supplied pack.
- TypeScript AST comparison: 187 non-render functions/handlers across workspace, AI assistant and template controls are unchanged; component state/setup/lifecycle statements are also identical.
- Existing step/dataset component keys, hidden mounted panels, correction owner and request revision/approval handlers remain unchanged.
- Existing unrelated working-tree changes and sample removals were preserved. Nothing pushed, committed, merged or deployed. Landing previews were not regenerated.

## Limitations and release gates

- Component/browser fixtures use the real workspace/parser/validation/correction implementation with synthetic project/template API responses. They do not create an authenticated session or prove server ownership boundaries with two accounts.
- Real authenticated E2E remains NOT TESTED: legitimate external primary/secondary Playwright storage states are absent.
- Ollama offline/unavailable, malformed output, cancellation and stale requests are tested using controlled transport. No real inference quality measurement or physical model shutdown is claimed for this presentation task. Existing model/provider settings and safeguards are untouched.
- Responsive checks cover Chromium at 320, 375, 390, 768, 1024 and 1440px, Light/Dark and System. They are not a screen-reader certification or cross-browser audit.
- The existing Next.js 16.4.0 security advisory remains a production release blocker. This UI task does not upgrade or suppress it.

## Browser run details

```powershell
$env:PLAYWRIGHT_BASE_URL='http://localhost:3001'
$env:PLAYWRIGHT_USE_EXISTING_SERVER='1'
$env:PLAYWRIGHT_JSON_OUTPUT_FILE='playwright/.cache/rowzen-workspace-20261027/results-final.json'
npx.cmd playwright test tests/e2e/rowzen-workspace.public.spec.ts tests/e2e/upload-presentation.public.spec.ts tests/e2e/schema-mapping.public.spec.ts tests/e2e/mapping-commit.public.spec.ts tests/e2e/ai-schema-mapping.public.spec.ts tests/e2e/guided-workspace.public.spec.ts tests/e2e/configuration-errors.public.spec.ts tests/e2e/workspace-verification.public.spec.ts --project=public-chromium --workers=1 --reporter=list,json
```

| Spec | Passed |
| --- | --- |
| ai-schema-mapping.public.spec.ts | 22 |
| configuration-errors.public.spec.ts | 2 |
| guided-workspace.public.spec.ts | 13 |
| mapping-commit.public.spec.ts | 2 |
| rowzen-workspace.public.spec.ts | 18 |
| schema-mapping.public.spec.ts | 8 |
| upload-presentation.public.spec.ts | 9 |
| workspace-verification.public.spec.ts | 8 |

The final run includes all six widths, Light/Dark, System following OS changes without remount, keyboard Enter/Space and focus restoration, actual invalid-file recovery, template compatibility/confirmation, AI rejection/approval/cancellation, malformed/stale/offline model responses, retained correction history and original data, Undo/Redo, deterministic What-if, and existing report/corrected CSV downloads.

Earlier development runs are retained rather than counted as passes. New-test assumptions were corrected to use the actual Undo/Redo API, the existing first-field focus target on mapping Cancel, and template fixtures registered before list loading. Existing browser assertions that treated an unset rule as string were changed to require the new truthful empty selection. Safety, validation, approval, privacy and state-preservation assertions remain in place.

## Final status

Upload/Configure presentation verification passed within the stated fixture scope. The task-owned production test server on port 3001 was stopped. No command was issued to stop the user's development server on port 3000. Full application Vitest and real authenticated/two-account E2E were not run for this focused task. No real-model quality claim is made. Production readiness remains blocked by the separately documented Next.js advisory and outstanding genuine-session release gates.

Logs: vitest-baseline.log, vitest-focused-final.log, vitest-regression.log, playwright-final-verified.log, results-final.json, typescript-final.log, lint-final.log, build-final-security-reminder.log, build-final.log. Machine-readable summary: verification-summary.json. Original failures/interrupted development runs remain separately recorded.
