# Coverage warning fixes — 31 October 2026

The supplied `npm run test:coverage` output already had 748 passing tests. The issues were a Vite config module-format warning and repeated React SVG title warnings; the coverage percentages and uncovered line numbers were informational.

- Renamed `vitest.config.ts` to `vitest.config.mts` so its existing ESM imports/export have an explicit module format. The installed Vitest/Vite versions discover `.mts` automatically. Test globs, environment, coverage defaults and package module type are unchanged; no warning-suppression flag was added.
- Changed the dependency graph node title from mixed JSX children to one formatted string containing the same dataset name and dependency state. This preserves complete native SVG tooltip text and removes the React warning.
- Added three regressions in `tests/ui/readiness-insights.test.tsx`: ordered datasets, configuration errors, and cycles/downstream blocking. They assert complete title markup and no React console errors; the spy forwards errors normally rather than suppressing them. All three failed before the fix.

Actual verification:

| Check | Result |
| --- | --- |
| Baseline full coverage | 748 passed, 85 files; config warning reproduced. |
| Focused new regressions before fix | 3 failed, 8 existing tests passed; React title warnings reproduced. |
| `npm.cmd run test:coverage` after fix | **751 passed**, 85 files, 14.25s; neither reported warning appeared. |
| `npx.cmd tsc --noEmit --incremental false` | Passed, exit 0. |
| `npm.cmd run lint` | Passed, zero errors; existing warnings in generated `coverage/block-navigation.js` and unused `samplePath` remain. |
| `npm.cmd run build` | Passed; compilation, TypeScript and all 15 static pages generated. |

V8 coverage remains **67.78% statements, 61.14% branches, 66.76% functions and 73.64% lines**. No files were removed from coverage, thresholds lowered or tests weakened. The browser suite was not rerun for this SVG text/config fix; V8 unit/integration coverage does not include Playwright execution. Earlier project and shell fixes remain intact.

Run `npm run test:coverage` from the repository root to regenerate the report at `coverage/index.html`.

## Default test command stability

The later 775-test suite intermittently exceeded the unchanged five-second test deadline in OAuth initialization, the client bundle check, screenshot asset checks and upload rendering. On this Windows machine, Vitest resolved its default to 11 simultaneous isolated fork workers with approximately 1 GiB free memory. A plain `npm test` reproduced the bundle-check timeout (774 passed, one failed); the other reported failures did not reproduce in that run.

`vitest.config.mts` now sets `maxWorkers: 1` so the normal test and coverage commands avoid that resource contention without extra CLI flags. Per-file isolation and the five-second timeout remain enabled. Assertions, test discovery and application code are unchanged; no skips, retries or timeout increases were added. The cumulative workers-spawned count can still reflect one isolated worker per file over the whole run.

Actual verification after this change:

| Command | Result |
| --- | --- |
| `npm.cmd test` | 775 passed, 89 files, zero failed/skipped, 33.05s. |
| `npm.cmd test` (repeat) | 775 passed, 89 files, zero failed/skipped, 29.59s. |
| `npm.cmd run test:coverage` | 775 passed, 89 files, zero failed/skipped, 37.02s. |
| `npx.cmd tsc --noEmit --incremental false` | Passed, exit 0. |
| `npm.cmd run lint` | Passed, zero errors; two existing warnings in `coverage/block-navigation.js` and `tests/e2e/release-privacy.auth.spec.ts`. |

Current coverage is 67.90% statements, 61.36% branches, 66.86% functions and 73.75% lines. This change trades parallel test speed for consistent execution on constrained development machines; it does not change production behavior.
