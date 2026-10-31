# Rowzen AI assistants — UI verification

Date: 30 October 2026. Local implementation only; no push or deployment.

## Audit aur implementation summary

Pehle mapping UI mein evidence zyada jagah leta tha aur source/target comparison clear nahi tha. Ab suggestions pehle review hoti hain, source → target readable hai, selection count actual state se aata hai, aur explanations/evidence on demand khulte hain. Existing manual mapping editor, template compatibility, consent aur Apply/Reject handlers preserve hain.

Root-cause UI mein hypotheses, verified findings aur next actions ek long flow mein the. Ab hypothesis disclosure, cited finding rows, individual issue navigation aur investigation guidance alag groups mein hain. Potential datasets sirf existing evidence se aate hain. Graph action existing workspace navigation/focus helper reuse karta hai. Workspace badalne par old explanations hide hoti hain aur fresh analysis ka clear notice aata hai.

Repair UI ab Suggested repair → What-if preview → Apply correction stages dikhati hai. Original/current values neutral hain; sirf changed proposed value highlight hoti hai. Preview actual deterministic metrics aur resolved/introduced findings use karta hai. Verification details on demand hain. Required-input result existing settings tak explicit action deta hai; user meaning change kare to fresh consent required rehti hai. Confirmation, Undo/Redo aur history handlers unchanged hain.

## Source audit

Inspected the three assistant components, shared request status, their session/context owners, `upload-workspace.tsx`, `correction-workspace.tsx`, `what-if-panel.tsx`, design primitives, UI guide, provider/contract tests and existing public browser fixtures before editing. No new AI capability or request owner was added.

Design references were used for interaction ideas, with original Rowzen components and tokens: [Flatfile mapping](https://support.flatfile.com/articles/8569925090-mapping-data), [Datadog Service Map](https://docs.datadoghq.com/tracing/services/services_map/) and [Linear](https://linear.app/). No branded artwork, statistics or functionality was copied. The Datadog page could not be retrieved by the web reader, so this is not a claim of visual reproduction.

## Changed files

| File | Presentation change |
| --- | --- |
| `src/components/ai/ai-presentation.tsx` | Shared panel, disclosure, state label and semantic review-stage primitives |
| `src/components/ai/schema-mapping-assistant.tsx` | Read-only source/target comparison, review labels, selected count, compact template comparison, on-demand explanation and evidence |
| `src/components/ai/root-cause-analyzer.tsx` | Structured hypothesis/evidence/investigation groups, per-finding actions, potential dataset labels, stale-output notice and graph action |
| `src/components/ai/smart-repair-planner.tsx` | Three-stage review, changed-value comparison, required-input action and focused approval controls |
| `src/components/ai/ai-request-status.tsx` | Compact shared status, optional task-specific loading copy and reuse of the existing reduced-motion-aware spinner |
| `src/components/corrections/what-if-panel.tsx` | Optional compact display of changed metrics; default full preview preserved; contained keyboard-scrollable table |
| `src/components/upload/upload-workspace.tsx` | Connect graph action through the existing revealTarget helper, including view selection, disclosure opening, scrolling and focus |
| `tests/e2e/ai-assistants-ui.public.spec.ts` | New real-component browser fixtures for loading, results, state transitions, mobile keyboard scrolling and contrast |
| `tests/ui/what-if-panel.test.tsx` | Additional compact-mode regression; existing assertions retained |
| `docs/ai-assistants-ui-redesign.md` | Audit and actual verification results |

The pre-existing `next-env.d.ts` modification was left alone. No dependency, authentication, Prisma, API, exporter, provider, prompt, model configuration, validation engine, correction engine or model-quality expectation was changed. Existing browser assertions and test deadlines were not weakened.

## State and safety behavior

- Generating actions say **Analyzing mappings…**, **Analyzing issues…**, or **Finding repair options…**, with the existing button spinner and disabled duplicate submission. No progress percentages or artificial delays were added.
- Consent text and snapshot-scoped consent remain intact. Raw CSV values are displayed only where the existing repair UI already allowed them; no additional data is sent to the model.
- Empty/no-op, unavailable, error, cancelled, retry and stale states retain manual workflows. Changing source meaning invalidates old consent and candidates.
- Suggested settings remain unverified advice. Drift/evidence come from existing local checks. Potential downstream datasets never imply affected-row counts or proven causality.
- A repair strategy is not labeled verified before the existing deterministic verification is available. Apply remains behind preview eligibility, freshness checks and explicit user confirmation.
- The compact What-if view filters displayed metrics only. Counts and calculations are unchanged, unknown row-validity counts remain unknown, and manual correction still uses the full default preview.
- Native disclosures, semantic lists, focusable value/metric regions and wrapping actions support keyboard and mobile use. Motion uses existing reduced-motion-aware primitives.

## Actual final checks

| Check | Result |
| --- | --- |
| Relevant Vitest suites: AI contracts/session/providers/quality fixtures, UI, What-if, correction/security/workspace integration | **483 passed**, 26 files, zero failed |
| Combined development-server browser run: existing mapping 22 + existing repair 24 + new UI cases 33 | **79 passed**, zero failed/skipped/flaky |
| Existing parent-workspace offline root-cause navigation checks, 320 and 1440px | **2 passed** |
| New UI suite against the isolated local production build, including two additional keyboard-scroll/contrast cases | **35 passed**, zero failed/skipped/flaky |
| Full lint | Passed; one pre-existing unused samplePath warning in release-privacy.auth.spec.ts |
| TypeScript, including the final test file | Passed |
| Clean npm ci and production build in a temporary source copy | Passed on Node 24.22.1 |
| Final build after reusing the parent workspace focus helper | Passed on Node 24.22.1 |

The new browser matrix covers **320, 375, 768, 1024 and 1440px, both light and dark**, for each assistant's actual generating and result states. It verifies disabled duplicate requests, reduced-motion spinner behavior, source/target and evidence disclosures, issue navigation, explicit repair preview/confirmation and no horizontal document overflow. Existing suites additionally cover System theme changes, malformed responses, stale requests, privacy, manual fallback, correction history, Undo/Redo and exports. Keyboard scrolling and at least 4.5:1 measured text contrast were checked for the compact mobile preview in both themes.

Screenshots inspected include mapping review at 320px/light and 1440px/light; analysis review and potential impact at 375px/dark; repair preview at 320px/dark and 1440px/light; and repair generating at 320px/light. Loading, suggestion and preview captures for every matrix size/theme are retained in the evidence folders. The compact mobile table was adjusted after visual inspection to keep headers/values readable, with contained horizontal scrolling instead of broken words.

These screenshots render the actual components with synthetic fixtures and intercepted model transport. They do not claim real-model inference or a real account session. No live Ollama benchmark was rerun, and previous model-quality findings are not reclassified as passed by these UI checks. Chromium verification is not a complete cross-browser or assistive-technology certification.

## Commands and evidence

```powershell
npm.cmd test -- tests/unit/ai tests/integration/ai tests/integration/root-cause-provider.test.ts tests/integration/smart-repair-provider.test.ts tests/integration/smart-repair-security.test.ts tests/integration/smart-repair-workspace.test.ts tests/unit/corrections/what-if.test.ts tests/integration/corrections/what-if.integration.test.ts tests/ui/schema-mapping.test.tsx tests/ui/root-cause-analyzer.test.tsx tests/ui/smart-repair-planner.test.tsx tests/ui/what-if-panel.test.tsx --maxWorkers=2
npm.cmd run lint
npm.cmd run typecheck

# Existing local server; no real auth storage state supplied.
$env:PLAYWRIGHT_BASE_URL='http://localhost:3000'
$env:PLAYWRIGHT_USE_EXISTING_SERVER='1'
$env:PLAYWRIGHT_ENVIRONMENT='development'
npm.cmd run test:e2e -- tests/e2e/ai-assistants-ui.public.spec.ts tests/e2e/ai-schema-mapping.public.spec.ts tests/e2e/ai-smart-repair.public.spec.ts --project=public-chromium --workers=1
npm.cmd run test:e2e -- tests/e2e/rowzen-review.public.spec.ts --grep 'offline Root-Cause' --project=public-chromium --workers=1

# Actual production build served locally; production deployment was not performed.
$env:PLAYWRIGHT_BASE_URL='http://localhost:3010'
npm.cmd run test:e2e -- tests/e2e/ai-assistants-ui.public.spec.ts --project=public-chromium --workers=1

# Executed inside the owned temporary source copy:
npm ci
npm run build
```

Final JSON reports, redacted build logs, source-copy provenance and screenshot folders are under `playwright/.cache/ai-assistant-redesign/` and ignored by Git. `vitest.json`, `browser.json` and `production-browser.json` hold the completed results. The combined 79-case run preceded the two additional mobile accessibility cases; the production run contains all 35 new UI cases.

The temporary build received no real environment files. Build/runtime values stayed in child-process memory and retained logs were redacted. The owned verification server on port 3010 was stopped; the user's original development server on port 3000 was preserved. No deployment, migration, push or automatic staging was performed.

## Follow-up: repair stage visibility

Active stage ab full indigo border/background se clear hai. Result par automatic scrolling ke baad bhi uske paas current-step label visible rehta hai:

- **Suggested repair:** request, required-input, unsupported or guidance-only state.
- **What-if preview:** a supported local candidate exists and awaits preview/review.
- **Apply correction:** the preview is open and the existing deterministic improvement gate permits approval. An adverse/non-eligible preview stays at the review stage.

The stage indicator never applies a correction. The existing Apply button and confirmation remain required. Added browser assertions check that Step 2 and Step 3 labels are actually in the viewport after their respective focus/scroll transitions. This follow-up passed **11 browser cases** across five widths in both themes plus the required-input flow, **10 relevant unit tests**, targeted lint and TypeScript. The updated screenshot was visually inspected. Evidence: `playwright/.cache/ai-repair-stage-visibility/`. The earlier production-build results above describe the preceding redesign verification; a production build was not repeated for this follow-up presentation change.

## Follow-up: a text field configured as boolean

The reported local result identified `INVALID_TYPE` on `full_name`, with a confirmed yes/no boolean convention and `BOOLEAN_TOKEN_UNRECOGNIZED` local-resolution guidance. The configured boolean rule did not match the current value. Confirming a convention does not make an arbitrary text value convertible. The existing verifier correctly withheld a replacement, preview and approval.

The UI now shows the selected finding, configured type and actual confirmed convention. Non-actionable output is explicitly classified as input required, guidance only, unsupported repair or blocked verification. It states why preview/Apply are unavailable instead of letting the generic “AI suggestion” heading imply an actionable edit. Fresh-consent requirements are also explained beside the request action.

For INVALID_TYPE results, **Review field type** uses the existing workspace anchor navigation to open Configure, select the correct dataset and focus that exact column's existing type control. Type controls received stable encoded IDs; no validation rule is changed automatically. If the column is intended to contain names/text, the user can choose string and revalidate. If it is genuinely boolean, the user must review the source value or its intended convention. No identifier, missing value or boolean replacement is guessed.

Verification completed:

- **105 relevant unit/integration tests passed**, plus targeted lint and TypeScript.
- **15 final browser cases passed**: repair loading/review across five widths and both themes, fresh-input consent, unavailable AI, abstention, malformed output and the reported wrong-field-type class of failure.
- The reported case was reproduced with a synthetic text name configured as boolean. Preview and Apply correctly remained absent; the new link focused the actual type control. Changing the rule to string and revalidating resolved the finding without changing a CSV cell or correction history. The rendered diagnostic screenshot was inspected.
- **Two real local Ollama browser checks passed**, using the approved qwen2.5:0.5b model and synthetic data: direct confirmed normalization, and Unknown → confirm convention → fresh consent → new request → preview → explicit approval → Undo. The latter asserts that the second request offers BOOLEAN_FROM_CONFIRMED_CONVENTION and no longer requests confirmation. These checks establish those two flows, not complete model-quality certification.
- The final source was built successfully on Node 24.22.1 in the owned temporary copy. No deploy, migration, push or real-account mutation occurred.

Evidence folders: `playwright/.cache/repair-live-diagnosis/`, `repair-live-confirmation/`, `repair-result-final/`; redacted final build status/log remain under `playwright/.cache/ai-assistant-redesign/`. No AI contracts, providers, validation/correction engines or expected quality outcomes were changed.
